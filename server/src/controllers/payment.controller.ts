import { createHmac, timingSafeEqual } from 'node:crypto'
import type { Request, Response } from 'express'
import { z } from 'zod'
import { Event } from '../models/event.model.js'
import { PaymentAttempt } from '../models/payment-attempt.model.js'
import { Registration } from '../models/registration.model.js'
import { User } from '../models/user.model.js'
import { eventHasRoomFilter } from '../utils/capacity.js'
import { sendRegistrationConfirmation } from '../services/email.js'
import { randomUUID } from 'node:crypto'
import { calculatePlatformFeePaise } from '../services/event-ledger.js'
import { withEventLedgerLock } from '../services/event-ledger.js'
import { LedgerEntry } from '../models/ledger-entry.model.js'

const razorpayBase = 'https://api.razorpay.com/v1'
function razorpayAuth() {
  const keyId = process.env.RAZORPAY_KEY_ID
  const keySecret = process.env.RAZORPAY_KEY_SECRET
  if (!keyId || !keySecret) return null
  return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`
}
async function refundPayment(paymentId: string, amount: number, attempt: { event: { toString(): string } } | null) {
  const authorization = razorpayAuth()
  if (!authorization || !attempt) return false
  const event = await Event.findById(attempt.event.toString()).select('host')
  if (!event) return false
  const placeholderId = `pending-refund-${randomUUID()}`
  const pendingEntry = await withEventLedgerLock(event.id, () => LedgerEntry.create({ eventId: event.id, organiserId: String(event.host), type: 'refund', razorpayId: placeholderId, amountPaise: amount, status: 'requested', metadata: { paymentId } }))
  const result = await fetch(`${razorpayBase}/payments/${encodeURIComponent(paymentId)}/refund`, { method: 'POST', headers: { Authorization: authorization, 'Content-Type': 'application/json' }, body: JSON.stringify({ amount }) })
  if (!result.ok) { pendingEntry.status = 'failed'; await pendingEntry.save(); return false }
  const refund = await result.json() as { id?: string }
  if (!refund.id) { pendingEntry.status = 'failed'; await pendingEntry.save(); return false }
  try { pendingEntry.razorpayId = refund.id; await pendingEntry.save() }
  catch { await LedgerEntry.deleteOne({ _id: pendingEntry.id, razorpayId: placeholderId }) }
  return true
}

export async function createEventOrder(request: Request, response: Response) {
  const parsed = z.object({ formData: z.record(z.string(), z.union([z.string().max(5000), z.number(), z.boolean()])).default({}) }).safeParse(request.body)
  if (!parsed.success) return response.status(400).json({ message: 'Registration details are invalid.' })
  const event = await Event.findOne({ _id: request.params.id, status: 'published' })
  if (!event) return response.status(404).json({ message: 'Event not found.' })
  if (String(event.host) === request.auth.sub) return response.status(403).json({ message: 'Organisers cannot register for their own event.' })
  if (event.priceAmountPaise <= 0) return response.status(400).json({ message: 'This event does not require payment.' })
  if ((event.minTeamSize ?? 1) > 1 || event.priceUnit === 'team') return response.status(400).json({ message: 'Paid team registration is not available until team payment collection is enabled.' })
  if (await Registration.exists({ user: request.auth.sub, event: event.id, status: { $ne: 'cancelled' } })) return response.status(409).json({ message: 'You already have a registration for this event.' })
  const authorization = razorpayAuth()
  if (!authorization) return response.status(503).json({ message: 'Razorpay is not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to server/.env.' })

  const feeBps = Number(process.env.PLATFORM_FEE_BPS || 300)
  const platformFeePaise = calculatePlatformFeePaise(event.priceAmountPaise, feeBps)
  const amount = event.platformFeePayer === 'applicant' ? event.priceAmountPaise + platformFeePaise : event.priceAmountPaise
  const orderResponse = await fetch(`${razorpayBase}/orders`, {
    method: 'POST', headers: { Authorization: authorization, 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount, currency: 'INR', receipt: `vista_${event.id}_${Date.now()}`, notes: { eventId: event.id, userId: request.auth.sub } }),
  })
  const order = await orderResponse.json() as { id?: string; error?: { description?: string } }
  if (!orderResponse.ok || !order.id) return response.status(502).json({ message: order.error?.description || 'Razorpay could not create a payment order.' })
  await PaymentAttempt.create({ orderId: order.id, event: event.id, user: request.auth.sub, amount, baseAmountPaise: event.priceAmountPaise, platformFeePaise, platformFeePayer: event.platformFeePayer || 'organiser', formData: parsed.data.formData })
  response.status(201).json({ orderId: order.id, amount, baseAmountPaise: event.priceAmountPaise, platformFeePaise, currency: 'INR', keyId: process.env.RAZORPAY_KEY_ID, eventName: event.title })
}

export async function verifyEventPayment(request: Request, response: Response) {
  const parsed = z.object({ razorpay_order_id: z.string(), razorpay_payment_id: z.string(), razorpay_signature: z.string() }).safeParse(request.body)
  if (!parsed.success) return response.status(400).json({ message: 'Razorpay payment details are incomplete.' })
  const attempt = await PaymentAttempt.findOne({ orderId: parsed.data.razorpay_order_id, user: request.auth.sub })
  if (!attempt) return response.status(404).json({ message: 'Payment order not found.' })
  if (attempt.status === 'paid') {
    const registered = await Registration.findOne({ paymentId: attempt.paymentId }).select('_id')
    if (registered) return response.json({ registrationId: registered.id })
  }
  const existingPaymentRegistration = await Registration.findOne({ paymentId: parsed.data.razorpay_payment_id }).select('_id')
  if (existingPaymentRegistration) {
    attempt.paymentId = parsed.data.razorpay_payment_id
    attempt.status = 'paid'
    await attempt.save()
    return response.json({ registrationId: existingPaymentRegistration.id })
  }
  if (attempt.status === 'refunded') return response.status(409).json({ message: 'This payment was refunded because the event could not accept the registration.' })
  const secret = process.env.RAZORPAY_KEY_SECRET
  if (!secret) return response.status(503).json({ message: 'Payment verification is not configured.' })
  const expected = createHmac('sha256', secret).update(`${parsed.data.razorpay_order_id}|${parsed.data.razorpay_payment_id}`).digest()
  let supplied: Buffer
  try { supplied = Buffer.from(parsed.data.razorpay_signature, 'hex') } catch { supplied = Buffer.alloc(0) }
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return response.status(400).json({ message: 'Payment signature verification failed.' })

  const authorization = razorpayAuth()!
  const paymentResponse = await fetch(`${razorpayBase}/payments/${encodeURIComponent(parsed.data.razorpay_payment_id)}`, { headers: { Authorization: authorization } })
  const payment = await paymentResponse.json() as { order_id?: string; amount?: number; currency?: string; status?: string }
  if (!paymentResponse.ok || payment.order_id !== attempt.orderId || payment.amount !== attempt.amount || payment.currency !== 'INR' || !['authorized', 'captured'].includes(payment.status || '')) {
    return response.status(402).json({ message: 'Razorpay has not confirmed the expected payment amount.' })
  }
  if (payment.status === 'authorized') {
    const captureResponse = await fetch(`${razorpayBase}/payments/${encodeURIComponent(parsed.data.razorpay_payment_id)}/capture`, { method: 'POST', headers: { Authorization: authorization, 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: attempt.amount, currency: 'INR' }) })
    if (!captureResponse.ok) return response.status(402).json({ message: 'Payment is authorized but capture failed. Contact Vista support before retrying.' })
  }
  attempt.paymentId = parsed.data.razorpay_payment_id
  await attempt.save()

  const event = await Event.findOne({ _id: attempt.event, status: 'published' })
  if (!event) {
    const refunded = await refundPayment(parsed.data.razorpay_payment_id, attempt.amount, attempt)
    if (refunded) { attempt.status = 'refunded'; await attempt.save() }
    return response.status(409).json({ message: refunded ? 'The event stopped accepting registrations. Razorpay has been asked to refund your payment.' : 'The event stopped accepting registrations and automatic refund did not complete. Contact Vista support about this payment.' })
  }
  const place = await Event.findOneAndUpdate(eventHasRoomFilter(event.id), { $inc: { registeredCount: 1 } }, { new: true })
  if (!place) {
    const refunded = await refundPayment(parsed.data.razorpay_payment_id, attempt.amount, attempt)
    if (refunded) { attempt.status = 'refunded'; await attempt.save() }
    return response.status(409).json({ message: refunded ? 'The event filled during checkout. Razorpay has been asked to refund your payment.' : 'The event filled during checkout and automatic refund did not complete. Contact Vista support about this payment.' })
  }
  const ticketId = randomUUID()
  try {
    const registration = await Registration.create({ user: request.auth.sub, event: event.id, ticketId, formData: attempt.formData, paymentId: parsed.data.razorpay_payment_id })
    attempt.paymentId = parsed.data.razorpay_payment_id
    attempt.status = 'paid'
    await attempt.save()
    const user = await User.findById(request.auth.sub).select('name email')
    if (user) await sendRegistrationConfirmation({ email: user.email, name: user.name, eventTitle: event.title, eventId: event.id, startDate: event.startDate, venue: event.venue, ticketId, type: 'registered' }).catch((error) => console.error('Could not send paid registration email:', error))
    return response.status(201).json({ registrationId: registration.id })
  } catch (error) {
    await Event.updateOne({ _id: event.id }, { $inc: { registeredCount: -1 } })
    throw error
  }
}
