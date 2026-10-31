import assert from 'node:assert/strict'
import test from 'node:test'
import { createQrToken, verifyQrToken } from '../src/utils/qr-token.js'

test('signed ticket tokens contain only ticket, event, and ticket type', () => {
  process.env.QR_SIGNING_SECRET = 'test-signing-secret'
  const ticket = { ticketId: 'ticket-123', eventId: 'event-456', type: 'registered' as const }
  const token = createQrToken(ticket)
  const encodedPayload = token.split('.')[0]

  assert.deepEqual(verifyQrToken(token), ticket)
  assert.deepEqual(JSON.parse(Buffer.from(encodedPayload, 'base64url').toString()), ticket)
})

test('QR verification rejects a changed signature', () => {
  process.env.QR_SIGNING_SECRET = 'test-signing-secret'
  const token = createQrToken({ ticketId: 'ticket-123', eventId: 'event-456', type: 'invited' })
  const changed = `${token.slice(0, -1)}${token.endsWith('a') ? 'b' : 'a'}`

  assert.throws(() => verifyQrToken(changed), /invalid_signature/)
})
