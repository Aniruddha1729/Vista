import { createHmac, timingSafeEqual } from 'node:crypto'

export function verifyRazorpayWebhookSignature(rawBody: Buffer, signature: string, secret: string) {
  if (!secret || !signature) return false
  const expected = createHmac('sha256', secret).update(rawBody).digest()
  let supplied: Buffer
  try { supplied = Buffer.from(signature, 'hex') } catch { return false }
  return supplied.length === expected.length && timingSafeEqual(expected, supplied)
}
