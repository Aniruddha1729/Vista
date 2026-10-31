import assert from 'node:assert/strict'
import test from 'node:test'
import mongoose from 'mongoose'
import type { Request, Response } from 'express'
import { myTeamInvitations } from '../src/controllers/event.controller.js'
import { acceptTeamById } from '../src/controllers/team-registration.controller.js'
import { Event } from '../src/models/event.model.js'
import { Registration } from '../src/models/registration.model.js'
import { TeamRegistration } from '../src/models/team-registration.model.js'
import { User } from '../src/models/user.model.js'

function stub(target: object, key: string, replacement: unknown) {
  const record = target as Record<string, unknown>
  const original = record[key]
  record[key] = replacement
  return () => { record[key] = original }
}

function captureResponse() {
  const captured: { statusCode: number; body?: unknown } = { statusCode: 200 }
  const response = {
    status(code: number) { captured.statusCode = code; return this },
    json(body: unknown) { captured.body = body; return this },
  }
  return { captured, response: response as unknown as Response }
}

test('team invitations are returned for the signed-in user without exposing invitation tokens', async () => {
  const userId = new mongoose.Types.ObjectId()
  const teamId = new mongoose.Types.ObjectId()
  const invitation = {
    _id: teamId,
    teamName: 'Green Sparks',
    teamSize: 2,
    status: 'pending',
    expiresAt: new Date(Date.now() + 60_000),
    event: { title: 'Campus Hack Day', slug: 'campus-hack-day', startDate: new Date(), venue: 'Innovation Hall' },
    leader: { name: 'Ari', username: 'ari' },
    members: [{ email: 'member@example.test', status: 'pending', tokenHash: 'private-hash' }],
  }
  const query = {
    populate() { return this },
    sort() { return this },
    async lean() { return [invitation] },
  }
  const restore = [
    stub(User, 'findById', () => ({ select: async () => ({ email: 'member@example.test' }) })),
    stub(TeamRegistration, 'updateMany', async () => ({})),
    stub(TeamRegistration, 'find', () => query),
  ]
  const { captured, response } = captureResponse()
  try {
    await myTeamInvitations({ auth: { sub: userId.toString() } } as Request, response)
    const body = captured.body as { invitations: { id: string; memberStatus: string }[] }
    assert.equal(captured.statusCode, 200)
    assert.equal(body.invitations.length, 1)
    assert.equal(body.invitations[0].id.toString(), teamId.toString())
    assert.equal(body.invitations[0].memberStatus, 'pending')
    assert.equal(JSON.stringify(body).includes('private-hash'), false)
  } finally {
    restore.reverse().forEach((restoreStub) => restoreStub())
  }
})

test('last teammate acceptance confirms a team and creates a registration for each member', async () => {
  const leaderId = new mongoose.Types.ObjectId()
  const joiningMemberId = new mongoose.Types.ObjectId()
  const eventId = new mongoose.Types.ObjectId()
  const teamId = new mongoose.Types.ObjectId()
  const leader = { _id: leaderId, id: leaderId.toString(), name: 'Ari', email: 'ari@example.test', emailVerified: true }
  const joiningMember = { _id: joiningMemberId, id: joiningMemberId.toString(), name: 'Lee', email: 'lee@example.test', emailVerified: true }
  const members = [{ email: joiningMember.email, status: 'pending' as string, user: undefined as mongoose.Types.ObjectId | undefined }]
  const team = {
    _id: teamId,
    id: teamId.toString(),
    leader: leaderId,
    event: eventId,
    teamName: 'Green Sparks',
    teamSize: 2,
    status: 'pending',
    expiresAt: new Date(Date.now() + 60_000),
    formData: { name: 'Green Sparks' },
    members,
    async save() {},
  }
  const event = { _id: eventId, id: eventId.toString(), title: 'Campus Hack Day', startDate: new Date(), venue: 'Innovation Hall' }
  let registrationsCreated: { user: mongoose.Types.ObjectId; ticketId: string }[] = []
  const findById = (id: mongoose.Types.ObjectId | string) => ({ select: async () => id.toString() === joiningMemberId.toString() ? joiningMember : leader })
  const query = { select: async () => [joiningMember] }
  const restore = [
    stub(TeamRegistration, 'findById', async () => team),
    stub(TeamRegistration, 'findOneAndUpdate', async () => { team.status = 'processing'; return team }),
    stub(User, 'findById', findById),
    stub(User, 'find', () => query),
    stub(Event, 'findById', () => ({ select: async () => ({ host: undefined }) })),
    stub(Registration, 'exists', async () => null),
    stub(Registration, 'insertMany', async (rows: { user: mongoose.Types.ObjectId; ticketId: string }[]) => {
      registrationsCreated = rows
      return rows.map((row) => ({ ...row, id: row.ticketId }))
    }),
    stub(Event, 'findOneAndUpdate', async () => event),
  ]
  const originalSecret = process.env.QR_SIGNING_SECRET
  const originalBrevoKey = process.env.BREVO_API_KEY
  const originalBrevoSender = process.env.BREVO_SENDER_EMAIL
  process.env.QR_SIGNING_SECRET = 'unit-test-signing-secret'
  delete process.env.BREVO_API_KEY
  delete process.env.BREVO_SENDER_EMAIL
  const { captured, response } = captureResponse()
  try {
    await acceptTeamById({ params: { teamId: teamId.toString() }, auth: { sub: joiningMemberId.toString() } } as unknown as Request, response)
    const body = captured.body as { status: string }
    assert.equal(body.status, 'confirmed')
    assert.equal(team.status, 'confirmed')
    assert.equal(members.every((member) => member.status === 'accepted'), true)
    assert.equal(registrationsCreated.length, 2)
    assert.deepEqual(new Set(registrationsCreated.map((registration) => registration.user.toString())), new Set([leaderId.toString(), joiningMemberId.toString()]))
  } finally {
    restore.reverse().forEach((restoreStub) => restoreStub())
    if (originalSecret === undefined) delete process.env.QR_SIGNING_SECRET
    else process.env.QR_SIGNING_SECRET = originalSecret
    if (originalBrevoKey === undefined) delete process.env.BREVO_API_KEY
    else process.env.BREVO_API_KEY = originalBrevoKey
    if (originalBrevoSender === undefined) delete process.env.BREVO_SENDER_EMAIL
    else process.env.BREVO_SENDER_EMAIL = originalBrevoSender
  }
})
