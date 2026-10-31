import { randomUUID } from 'node:crypto'
import { Event } from '../models/event.model.js'

export type LedgerType = 'payment' | 'refund' | 'gateway_fee' | 'platform_fee' | 'payout' | 'payout_reversal'
export type LedgerStatus = 'created' | 'captured' | 'requested' | 'processing' | 'processed' | 'failed'
export type LedgerRow = { type: LedgerType; status: LedgerStatus; amountPaise: number }

export function calculatePlatformFeePaise(baseAmountPaise: number, feeBps = 300) {
  if (!Number.isSafeInteger(baseAmountPaise) || baseAmountPaise < 0 || !Number.isSafeInteger(feeBps) || feeBps < 0 || feeBps > 10_000) throw new Error('invalid_fee_input')
  return Math.floor((baseAmountPaise * feeBps + 5_000) / 10_000)
}

export function calculateRefundedPlatformFeePaise(feePaise: number, refundedPaise: number, originalPaymentPaise: number) {
  if (![feePaise, refundedPaise, originalPaymentPaise].every(Number.isSafeInteger) || feePaise < 0 || refundedPaise < 0 || originalPaymentPaise <= 0) throw new Error('invalid_refund_fee_input')
  const fee = BigInt(feePaise)
  const total = BigInt(originalPaymentPaise)
  const refunded = BigInt(Math.min(refundedPaise, originalPaymentPaise))
  return Number((fee * refunded + total / 2n) / total)
}

export function calculateLedgerBalance(rows: LedgerRow[]) {
  const total = (type: LedgerType, statuses: LedgerStatus[]) => rows.reduce((sum, row) => sum + (row.type === type && statuses.includes(row.status) ? row.amountPaise : 0), 0)
  const grossPaise = total('payment', ['captured'])
  const refundsPaise = total('refund', ['processed'])
  const pendingRefundsPaise = total('refund', ['requested', 'processing'])
  const gatewayFeesPaise = total('gateway_fee', ['captured'])
  const platformFeesPaise = total('platform_fee', ['captured'])
  const unreconciledGatewayFees = rows.some((row) => row.type === 'gateway_fee' && row.status === 'created')
  const payoutReversalsPaise = total('payout_reversal', ['processed'])
  const withdrawnPaise = Math.max(0, total('payout', ['processed']) - payoutReversalsPaise)
  const pendingPaise = total('payout', ['requested', 'processing'])
  const netPaise = grossPaise - refundsPaise - gatewayFeesPaise - platformFeesPaise
  const availablePaise = unreconciledGatewayFees ? 0 : Math.max(0, netPaise - withdrawnPaise - pendingPaise)
  return { grossPaise, refundsPaise, pendingRefundsPaise, gatewayFeesPaise, platformFeesPaise, netPaise, withdrawnPaise, pendingPaise, availablePaise, unreconciledGatewayFees }
}

export async function acquireEventLedgerLock(eventId: string, token: string = randomUUID()) {
  const now = new Date()
  const event = await Event.findOneAndUpdate({ _id: eventId, $or: [{ financeLockUntil: { $exists: false } }, { financeLockUntil: null }, { financeLockUntil: { $lt: now } }] }, { $set: { financeLockUntil: new Date(now.getTime() + 30_000), financeLockToken: token } }, { new: true }).select('_id')
  return event ? token : null
}

export async function releaseEventLedgerLock(eventId: string, token: string) {
  await Event.updateOne({ _id: eventId, financeLockToken: token }, { $unset: { financeLockUntil: 1, financeLockToken: 1 } })
}

export async function withEventLedgerLock<T>(eventId: string, work: () => Promise<T>): Promise<T> {
  const token = await acquireEventLedgerLock(eventId)
  if (!token) throw new Error('event_ledger_busy')
  try { return await work() } finally { await releaseEventLedgerLock(eventId, token) }
}

export type WithdrawalLedgerStore<T extends LedgerRow & { idempotencyKey?: string }> = {
  findByKey(key: string): Promise<T | null>
  acquireLock(): Promise<boolean>
  releaseLock(): Promise<void>
  getRows(): Promise<T[]>
  addPayout(input: { amountPaise: number; idempotencyKey: string }): Promise<T>
}

export async function requestLedgerWithdrawal<T extends LedgerRow & { idempotencyKey?: string }>(store: WithdrawalLedgerStore<T>, amountPaise: number, idempotencyKey: string) {
  const prior = await store.findByKey(idempotencyKey)
  if (prior) return { entry: prior, duplicate: true }
  if (!Number.isSafeInteger(amountPaise) || amountPaise <= 0) throw new Error('invalid_amount')
  if (!await store.acquireLock()) throw new Error('withdrawal_busy')
  try {
    const secondCheck = await store.findByKey(idempotencyKey)
    if (secondCheck) return { entry: secondCheck, duplicate: true }
    const rows = await store.getRows()
    const balance = calculateLedgerBalance(rows)
    if (balance.pendingRefundsPaise > 0) throw new Error('refund_pending')
    if (amountPaise > balance.availablePaise) throw new Error('insufficient_available')
    return { entry: await store.addPayout({ amountPaise, idempotencyKey }), duplicate: false }
  } finally {
    await store.releaseLock()
  }
}

