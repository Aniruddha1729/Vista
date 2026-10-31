import assert from 'node:assert/strict'
import test from 'node:test'
import type { Request, Response } from 'express'
import { addCoHost } from '../src/controllers/event.controller.js'
import { createInvite } from '../src/controllers/invite.controller.js'
import { Event } from '../src/models/event.model.js'
import { Registration } from '../src/models/registration.model.js'
import { User } from '../src/models/user.model.js'
import { hasProTier } from '../src/utils/user-plan.js'

function stub(target: object, key: string, replacement: unknown) {
  const record = target as Record<string, unknown>
  const original = record[key]
  record[key] = replacement
  return () => { record[key] = original }
}

function responseCapture() {
  const captured: { statusCode: number; body?: unknown } = { statusCode: 200 }
  const response = {
    status(code: number) { captured.statusCode = code; return this },
    json(body: unknown) { captured.body = body; return this },
  }
  return { captured, response: response as unknown as Response }
}

test('user tier grants Pro only while its subscription has not expired', () => {
  const now = Date.now()
  assert.equal(hasProTier({ plan: 'free' }, now), false)
  assert.equal(hasProTier({ plan: 'pro', proExpiresAt: new Date(now + 60_000) }, now), true)
  assert.equal(hasProTier({ plan: 'pro', proExpiresAt: new Date(now - 60_000) }, now), false)
})

test('Free users are rejected by the server after five event invitations', async () => {
  const restore = [
    stub(User, 'findById', () => ({ select: async () => ({ plan: 'free' }) })),
    stub(User, 'findOne', () => ({ select: async () => null })),
    stub(Event, 'findById', () => ({ select: () => ({ lean: async () => ({ inviteCount: 5 }) }) })),
    stub(Event, 'updateOne', async () => ({ matchedCount: 0 })),
    stub(Registration, 'findOne', async () => null),
  ]
  const { captured, response } = responseCapture()
  try {
    await createInvite({ auth: { sub: 'host-id' }, params: { id: 'event-id' }, body: { email: 'guest@example.test' }, event: { id: 'event-id', host: 'host-id', inviteTemplate: 'minimal' } } as unknown as Request, response)
    assert.equal(captured.statusCode, 403)
    assert.match(String((captured.body as { message: string }).message), /up to 5 invitations/)
  } finally { restore.reverse().forEach((restoreStub) => restoreStub()) }
})

test('Free users cannot add a sixth event staff member through the API', async () => {
  const restore = [
    stub(User, 'findOne', () => ({ select: async () => ({ id: 'new-staff', name: 'Guest', username: 'guest', email: 'guest@example.test' }) })),
    stub(User, 'findById', () => ({ select: async () => ({ plan: 'free' }) })),
    stub(Event, 'updateOne', async () => ({ matchedCount: 0 })),
    stub(Event, 'exists', async () => null),
  ]
  const { captured, response } = responseCapture()
  try {
    await addCoHost({ auth: { sub: 'host-id' }, body: { email: 'guest@example.test' }, event: { id: 'event-id', host: 'host-id' } } as unknown as Request, response)
    assert.equal(captured.statusCode, 403)
    assert.match(String((captured.body as { message: string }).message), /up to 5 event staff members/)
  } finally { restore.reverse().forEach((restoreStub) => restoreStub()) }
})
