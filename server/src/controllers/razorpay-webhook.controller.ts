import type { Request, Response } from 'express'
import { Event } from '../models/event.model.js'
import { LedgerEntry } from '../models/ledger-entry.model.js'
import { PaymentAttempt } from '../models/payment-attempt.model.js'
import { calculateRefundedPlatformFeePaise, withEventLedgerLock } from '../services/event-ledger.js'
import { verifyRazorpayWebhookSignature } from '../utils/razorpay-signature.js'

type GatewayEntity = {
  id?: string; order_id?: string; payment_id?: string; amount?: number; fee?: number; tax?: number
  notes?: Record<string, string>; status?: string
}
type RazorpayWebhook = { event?: string; payload?: { payment?: { entity?: GatewayEntity }; refund?: { entity?: GatewayEntity }; payout?: { entity?: GatewayEntity }; transfer?: { entity?: GatewayEntity } } }

function isPaise(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

async function upsertLedger(input: { eventId: string; organiserId: string; type: string; razorpayId: string; amountPaise: number; status: string; metadata?: Record<string, unknown> }) {
  await LedgerEntry.updateOne({ razorpayId: input.razorpayId, type: input.type }, { $setOnInsert: { eventId: input.eventId, organiserId: input.organiserId, type: input.type, razorpayId: input.razorpayId, amountPaise: input.amountPaise, status: input.status, metadata: input.metadata || {} } }, { upsert: true })
}

async function reconcileGatewayFee(payment: GatewayEntity, eventId: string, organiserId: string) {
  let fee = payment.fee
  let tax = payment.tax
  if (!isPaise(fee) || !isPaise(tax)) {
    const keyId = process.env.RAZORPAY_KEY_ID
    const keySecret = process.env.RAZORPAY_KEY_SECRET
    if (keyId && keySecret && payment.id) {
      const result = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(payment.id)}`, { headers: { Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}` }, signal: AbortSignal.timeout(8_000) })
      if (result.ok) {
        const detail = await result.json() as { fee?: number; tax?: number }
        fee = detail.fee
        tax = detail.tax
      }
    }
  }
  if (isPaise(fee) && isPaise(tax) && Number.isSafeInteger(fee + tax)) {
    const updated = await LedgerEntry.findOneAndUpdate({ razorpayId: payment.id, type: 'gateway_fee', status: 'created' }, { $set: { amountPaise: fee + tax, status: 'captured', metadata: { feePaise: fee, taxPaise: tax } } })
    if (!updated) await upsertLedger({ eventId, organiserId, type: 'gateway_fee', razorpayId: payment.id!, amountPaise: fee + tax, status: 'captured', metadata: { feePaise: fee, taxPaise: tax } })
    return true
  }
  return false
}

async function updateLedgerStatus(razorpayId: string, type: string, status: string) {
  const prior = await LedgerEntry.findOne({ razorpayId, type })
  if (!prior) return false
  const rank: Record<string, number> = { created: 0, requested: 0, processing: 1, captured: 2, processed: 2, failed: 2 }
  if ((rank[status] ?? 0) < (rank[prior.status] ?? 0) || (['captured', 'processed', 'failed'].includes(prior.status) && prior.status !== status)) return true
  prior.status = status as typeof prior.status
  await prior.save()
  return true
}

async function handleCapturedPayment(payment: GatewayEntity) {
  if (!payment.id || !payment.order_id || !isPaise(payment.amount)) return
  const attempt = await PaymentAttempt.findOne({ orderId: payment.order_id })
  if (!attempt) return
  const event = await Event.findById(attempt.event).select('host')
  if (!event) return
  await withEventLedgerLock(event.id, async () => {
    await upsertLedger({ eventId: event.id, organiserId: String(event.host), type: 'payment', razorpayId: payment.id!, amountPaise: payment.amount!, status: 'captured', metadata: { orderId: payment.order_id } })
    if (attempt.platformFeePaise > 0) await upsertLedger({ eventId: event.id, organiserId: String(event.host), type: 'platform_fee', razorpayId: payment.id!, amountPaise: attempt.platformFeePaise, status: 'captured', metadata: { feePayer: attempt.platformFeePayer, orderId: payment.order_id } })
    const feeKnown = await reconcileGatewayFee(payment, event.id, String(event.host))
    if (!feeKnown) {
      await upsertLedger({ eventId: event.id, organiserId: String(event.host), type: 'gateway_fee', razorpayId: payment.id!, amountPaise: 0, status: 'created', metadata: { feeReconciliationRequired: true } })
    }
  })
  attempt.paymentId = payment.id
  attempt.status = 'paid'
  await attempt.save()
}

async function handleRefund(refund: GatewayEntity, status: 'processing' | 'processed' | 'failed') {
  if (!refund.id || !refund.payment_id || !isPaise(refund.amount)) return
  const attempt = await PaymentAttempt.findOne({ paymentId: refund.payment_id })
  if (!attempt) return
  const event = await Event.findById(attempt.event).select('host')
  if (!event) return
  await withEventLedgerLock(event.id, async () => {
    await upsertLedger({ eventId: event.id, organiserId: String(event.host), type: 'refund', razorpayId: refund.id!, amountPaise: refund.amount!, status, metadata: { paymentId: refund.payment_id } })
    await updateLedgerStatus(refund.id!, 'refund', status)
    if (status === 'processed' && attempt.platformFeePaise > 0 && attempt.amount > 0) {
      const refundRows = await LedgerEntry.aggregate([{ $match: { eventId: event.id, organiserId: event.host, type: 'refund', status: 'processed', 'metadata.paymentId': refund.payment_id } }, { $group: { _id: null, totalPaise: { $sum: '$amountPaise' } } }])
      const totalRefundedPaise = Number(refundRows[0]?.totalPaise || 0)
      const reversedFee = calculateRefundedPlatformFeePaise(attempt.platformFeePaise, totalRefundedPaise, attempt.amount)
      const feeEntry = await LedgerEntry.findOne({ razorpayId: attempt.paymentId, type: 'platform_fee' })
      if (feeEntry) {
        feeEntry.amountPaise = Math.max(0, attempt.platformFeePaise - reversedFee)
        feeEntry.metadata = { ...feeEntry.metadata, refundedPlatformFeePaise: reversedFee }
        await feeEntry.save()
      }
    }
  })
}

async function handlePayout(entity: GatewayEntity, status: 'processing' | 'processed' | 'failed', reversed = false) {
  const ledgerId = entity.notes?.ledgerEntryId
  if (!ledgerId || !entity.id || !isPaise(entity.amount)) return
  const payout = await LedgerEntry.findOne({ _id: ledgerId, type: 'payout' })
  if (!payout) return
  await withEventLedgerLock(String(payout.eventId), async () => {
    if (reversed) {
      await upsertLedger({ eventId: String(payout.eventId), organiserId: String(payout.organiserId), type: 'payout_reversal', razorpayId: entity.id!, amountPaise: entity.amount!, status: 'processed', metadata: { payoutLedgerId: String(payout.id) } })
      return
    }
    payout.razorpayId = entity.id
    if (status === 'processing' && payout.status === 'requested') payout.status = 'processing'
    else if (status !== 'processing' && !['processed', 'failed'].includes(payout.status)) payout.status = status
    await payout.save()
  })
}

export async function razorpayWebhook(request: Request, response: Response) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET
  const rawBody = Buffer.isBuffer(request.body) ? request.body : null
  const signature = request.get('x-razorpay-signature') || ''
  if (!secret || !rawBody || !signature) return response.status(400).json({ message: 'Webhook signature configuration or raw payload is missing.' })
  if (!verifyRazorpayWebhookSignature(rawBody, signature, secret)) return response.status(400).json({ message: 'Invalid Razorpay webhook signature.' })
  const body = JSON.parse(rawBody.toString('utf8')) as RazorpayWebhook
  const entity = body.payload?.payment?.entity || body.payload?.refund?.entity || body.payload?.payout?.entity || body.payload?.transfer?.entity
  try {
    if (body.event === 'payment.captured' && body.payload?.payment?.entity) await handleCapturedPayment(body.payload.payment.entity)
    else if (body.event === 'refund.created' && body.payload?.refund?.entity) await handleRefund(body.payload.refund.entity, 'processing')
    else if (body.event === 'refund.processed' && body.payload?.refund?.entity) await handleRefund(body.payload.refund.entity, 'processed')
    else if (body.event === 'refund.failed' && body.payload?.refund?.entity) await handleRefund(body.payload.refund.entity, 'failed')
    else if (body.event === 'payout.created' && body.payload?.payout?.entity) await handlePayout(body.payload.payout.entity, 'processing')
    else if (body.event === 'payout.processed' && body.payload?.payout?.entity) await handlePayout(body.payload.payout.entity, 'processed')
    else if (body.event === 'payout.failed' && body.payload?.payout?.entity) await handlePayout(body.payload.payout.entity, 'failed')
    else if (body.event === 'transfer.created' && body.payload?.transfer?.entity) await handlePayout(body.payload.transfer.entity, 'processing')
    else if (body.event === 'transfer.processed' && body.payload?.transfer?.entity) await handlePayout(body.payload.transfer.entity, 'processed')
    else if (body.event === 'transfer.failed' && body.payload?.transfer?.entity) await handlePayout(body.payload.transfer.entity, 'failed')
    else if (body.event === 'transfer.reversed' && body.payload?.transfer?.entity) await handlePayout(body.payload.transfer.entity, 'processed', true)
    response.status(200).json({ received: true })
  } catch (error) {
    console.error('Razorpay webhook processing failed:', body.event, entity?.id, error)
    response.status(500).json({ message: 'Webhook processing failed; Razorpay may retry this event.' })
  }
}
