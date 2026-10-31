import { createHmac, timingSafeEqual } from 'node:crypto'

export type QrTicketPayload = { ticketId: string; eventId: string; type: 'registered' | 'invited' }

function signingSecret() {
  const secret = process.env.QR_SIGNING_SECRET
  if (!secret) throw new Error('QR_SIGNING_SECRET is not configured.')
  return secret
}

function signatureFor(payload: string) {
  return createHmac('sha256', signingSecret()).update(payload).digest('base64url')
}

export function createQrToken(ticket: QrTicketPayload) {
  const payload = Buffer.from(JSON.stringify(ticket)).toString('base64url')
  return `${payload}.${signatureFor(payload)}`
}

export function verifyQrToken(token: string): QrTicketPayload {
  const [payload, signature, extra] = token.split('.')
  if (!payload || !signature || extra) throw new Error('invalid_signature')

  let actualSignature: Buffer
  try {
    actualSignature = Buffer.from(signature, 'base64url')
  } catch {
    throw new Error('invalid_signature')
  }
  const expectedSignature = Buffer.from(signatureFor(payload), 'base64url')
  if (actualSignature.length !== expectedSignature.length || !timingSafeEqual(actualSignature, expectedSignature)) {
    throw new Error('invalid_signature')
  }

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Partial<QrTicketPayload>
    const keys = Object.keys(data).sort().join(',')
    if (keys !== 'eventId,ticketId,type' || !data.ticketId || !data.eventId || (data.type !== 'registered' && data.type !== 'invited')) {
      throw new Error('invalid_signature')
    }
    return { ticketId: data.ticketId, eventId: data.eventId, type: data.type }
  } catch {
    throw new Error('invalid_signature')
  }
}
