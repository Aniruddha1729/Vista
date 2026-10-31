import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateLedgerBalance, calculatePlatformFeePaise, calculateRefundedPlatformFeePaise, requestLedgerWithdrawal } from '../src/services/event-ledger.js'
import { createHmac } from 'node:crypto'
import { verifyRazorpayWebhookSignature } from '../src/utils/razorpay-signature.js'

type Entry = { type: 'payment' | 'refund' | 'gateway_fee' | 'platform_fee' | 'payout' | 'payout_reversal'; status: 'created' | 'captured' | 'requested' | 'processing' | 'processed' | 'failed'; amountPaise: number; idempotencyKey?: string; id: string }

function memoryStore(seed: Entry[]) {
  const rows = [...seed]
  let locked = false
  let nextId = 1
  return {
    rows,
    async findByKey(key: string) { return rows.find((row) => row.idempotencyKey === key) || null },
    async acquireLock() {
      while (locked) await new Promise((resolve) => setTimeout(resolve, 1))
      locked = true
      return true
    },
    async releaseLock() { locked = false },
    async getRows() { return [...rows] },
    async addPayout(input: { amountPaise: number; idempotencyKey: string }) {
      const entry: Entry = { id: `payout-${nextId++}`, type: 'payout', status: 'requested', ...input }
      rows.push(entry)
      return entry
    },
  }
}

test('ledger math subtracts processed refunds, gateway fees, platform fees, withdrawals and pending payouts', () => {
  const balance = calculateLedgerBalance([
    { type: 'payment', status: 'captured', amountPaise: 20_000 },
    { type: 'refund', status: 'processed', amountPaise: 2_000 },
    { type: 'refund', status: 'processing', amountPaise: 500 },
    { type: 'gateway_fee', status: 'captured', amountPaise: 600 },
    { type: 'platform_fee', status: 'captured', amountPaise: 600 },
    { type: 'payout', status: 'processed', amountPaise: 5_000 },
    { type: 'payout_reversal', status: 'processed', amountPaise: 1_000 },
    { type: 'payout', status: 'processing', amountPaise: 2_000 },
  ])
  assert.deepEqual(balance, { grossPaise: 20_000, refundsPaise: 2_000, pendingRefundsPaise: 500, gatewayFeesPaise: 600, platformFeesPaise: 600, netPaise: 16_800, withdrawnPaise: 4_000, pendingPaise: 2_000, availablePaise: 10_800, unreconciledGatewayFees: false })
})

test('the 3 percent platform fee is stored as integer paise', () => {
  assert.equal(calculatePlatformFeePaise(10_000), 300)
  assert.equal(calculatePlatformFeePaise(10_050), 302)
})

test('platform fee is reversed proportionally to processed refunds', () => {
  assert.equal(calculateRefundedPlatformFeePaise(300, 5_150, 10_300), 150)
  assert.equal(calculateRefundedPlatformFeePaise(300, 10_300, 10_300), 300)
})

test('Razorpay webhooks validate their signature against the original body bytes', () => {
  const body = Buffer.from('{"event":"payment.captured"}')
  const signature = createHmac('sha256', 'webhook-test-key').update(body).digest('hex')
  assert.equal(verifyRazorpayWebhookSignature(body, signature, 'webhook-test-key'), true)
  assert.equal(verifyRazorpayWebhookSignature(Buffer.from('{"event":"payment.failed"}'), signature, 'webhook-test-key'), false)
})

test('an unreconciled gateway fee prevents withdrawal availability', () => {
  const balance = calculateLedgerBalance([
    { type: 'payment', status: 'captured', amountPaise: 10_000 },
    { type: 'gateway_fee', status: 'created', amountPaise: 0 },
  ])
  assert.equal(balance.availablePaise, 0)
  assert.equal(balance.unreconciledGatewayFees, true)
})

test('double-clicks with the same idempotency key create one pending payout', async () => {
  const store = memoryStore([{ id: 'payment', type: 'payment', status: 'captured', amountPaise: 10_000 }])
  const [first, second] = await Promise.all([
    requestLedgerWithdrawal(store, 3_000, 'withdraw-click-123'),
    requestLedgerWithdrawal(store, 3_000, 'withdraw-click-123'),
  ])
  assert.equal(store.rows.filter((entry) => entry.type === 'payout').length, 1)
  assert.equal(first.entry.id, second.entry.id)
  assert.equal(Number(first.duplicate) + Number(second.duplicate), 1)
})

test('concurrent withdrawals with distinct keys cannot overdraw the event ledger', async () => {
  const store = memoryStore([{ id: 'payment', type: 'payment', status: 'captured', amountPaise: 10_000 }])
  const results = await Promise.allSettled([
    requestLedgerWithdrawal(store, 7_000, 'withdraw-click-456'),
    requestLedgerWithdrawal(store, 7_000, 'withdraw-click-789'),
  ])
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1)
  assert.equal(store.rows.filter((entry) => entry.type === 'payout').reduce((sum, entry) => sum + entry.amountPaise, 0), 7_000)
  const rejected = results.find((result) => result.status === 'rejected')
  assert.equal(rejected?.status === 'rejected' && (rejected.reason as Error).message, 'insufficient_available')
})

test('withdrawal is paused while a refund is in flight', async () => {
  const store = memoryStore([
    { id: 'payment', type: 'payment', status: 'captured', amountPaise: 10_000 },
    { id: 'refund', type: 'refund', status: 'processing', amountPaise: 1_000 },
  ])
  await assert.rejects(requestLedgerWithdrawal(store, 1_000, 'withdraw-click-321'), /refund_pending/)
})
