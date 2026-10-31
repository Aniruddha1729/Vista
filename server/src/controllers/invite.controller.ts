import type { Request, Response } from 'express'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { Event } from '../models/event.model.js'
import { Registration } from '../models/registration.model.js'
import { User } from '../models/user.model.js'
import { sendEmail, sendRegistrationConfirmation } from '../services/email.js'
import { renderInviteEmail } from '../services/invite-template.js'
import { eventHasRoomFilter } from '../utils/capacity.js'
import { createInviteToken, hashInviteToken } from '../utils/invite-token.js'
import type { InviteTemplateName } from '../services/invite-template.js'

const invitePreferences = z.object({
  template: z.enum(['minimal', 'bold-gradient', 'dark-neon', 'formal']),
  personalMessage: z.string().max(1000).optional(),
})
const inviteExpiresInMs = 30 * 24 * 60 * 60 * 1000

function inviteUrl(token: string) {
  const clientUrl = (process.env.CLIENT_URL || '').split(',')[0].trim().replace(/\/$/, '')
  return `${clientUrl}/invites/${encodeURIComponent(token)}`
}

type InviteMailEvent = {
  _id: { toString: () => string }
  title: string
  startDate: Date
  venue: string
  poster?: string
  host: unknown
  inviteTemplate: string
  inviteMessage: string
}

async function sendInvitation(registration: { inviteEmail?: string } | null, event: InviteMailEvent | null, token: string) {
  if (!registration || !event || !registration.inviteEmail) throw new Error('Invitation details are missing.')
  const host = await User.findById(event.host).select('name')
  const emailHtml = renderInviteEmail({
    template: event.inviteTemplate as InviteTemplateName,
    eventTitle: event.title,
    date: event.startDate.toLocaleString(),
    venue: event.venue,
    poster: event.poster,
    hostName: host?.name || 'Your campus host',
    personalMessage: event.inviteMessage,
    actionUrl: inviteUrl(token),
  })
  await sendEmail(registration.inviteEmail, '', `You’re invited to ${event.title}`, emailHtml)
}

export async function invitePreview(request: Request, response: Response) {
  const parsed = invitePreferences.safeParse(request.body)
  if (!parsed.success) return response.status(400).json({ message: 'Choose a valid invitation design.' })
  const host = await User.findById(request.event.host).select('name')
  const html = renderInviteEmail({
    template: parsed.data.template,
    eventTitle: request.event.title,
    date: request.event.startDate.toLocaleString(),
    venue: request.event.venue,
    poster: request.event.poster,
    hostName: host?.name || 'Your campus host',
    personalMessage: parsed.data.personalMessage || '',
    actionUrl: '#preview',
  })
  response.json({ html })
}

export async function listInvites(request: Request, response: Response) {
  const invites = await Registration.find({ event: request.params.id, type: 'invited' })
    .select('inviteEmail user status createdAt acceptedAt')
    .populate('user', 'name username email')
    .sort({ createdAt: -1 }).lean()
  response.json({ invites })
}

export async function createInvite(request: Request, response: Response) {
  const parsed = z.object({ email: z.email() }).safeParse(request.body)
  if (!parsed.success) return response.status(400).json({ message: 'Enter a valid email address.' })

  const email = parsed.data.email.toLowerCase()
  const event = request.event
  const existingUser = await User.findOne({ email }).select('_id')
  if (existingUser) {
    const existingRegistration = await Registration.findOne({ user: existingUser.id, event: event.id })
    if (existingRegistration) return response.status(409).json({ message: 'This person already has a registration or invitation for the event.' })
  }
  const existingInvite = await Registration.findOne({ event: event.id, inviteEmail: email })
  if (existingInvite) return response.status(409).json({ message: 'This email already has an invitation. Resend it from the invite list.' })

  const token = createInviteToken()
  const registration = await Registration.create({
    event: event.id,
    type: 'invited',
    status: 'pending',
    inviteEmail: email,
    inviteTokenHash: hashInviteToken(token),
    inviteExpiresAt: new Date(Date.now() + inviteExpiresInMs),
  })

  try {
    await sendInvitation(registration, event, token)
  } catch (error) {
    await registration.deleteOne()
    console.error('Could not send event invitation:', error)
    return response.status(502).json({ message: 'Could not send the invitation. Check Brevo settings and try again.' })
  }
  response.status(201).json({ invite: { _id: registration.id, email, status: registration.status, createdAt: registration.createdAt } })
}

export async function resendInvite(request: Request, response: Response) {
  const registration = await Registration.findOne({ _id: request.params.registrationId, event: request.params.id, type: 'invited', status: 'pending' }).select('+inviteTokenHash')
  if (!registration) return response.status(404).json({ message: 'Pending invitation not found.' })
  const event = request.event
  const token = createInviteToken()
  registration.inviteTokenHash = hashInviteToken(token)
  registration.inviteExpiresAt = new Date(Date.now() + inviteExpiresInMs)
  await registration.save()
  try {
    await sendInvitation(registration, event, token)
  } catch (error) {
    console.error('Could not resend event invitation:', error)
    return response.status(502).json({ message: 'Could not resend the invitation. Check Brevo settings and try again.' })
  }
  response.json({ message: 'Invitation sent again.' })
}

export async function deleteInvite(request: Request, response: Response) {
  const invite = await Registration.findOneAndDelete({ _id: request.params.registrationId, event: request.params.id, type: 'invited', status: 'pending' })
  if (!invite) return response.status(404).json({ message: 'Pending invitation not found.' })
  response.status(204).end()
}

export async function getInvite(request: Request, response: Response) {
  const invite = await Registration.findOne({ inviteTokenHash: hashInviteToken(String(request.params.token)), type: 'invited', status: 'pending' })
  if (!invite || !invite.inviteExpiresAt || invite.inviteExpiresAt.getTime() < Date.now()) {
    return response.status(410).json({ code: 'invite_expired', message: 'This invitation is no longer active. Ask the host to send it again.' })
  }
  const event = await Event.findById(invite.event).populate('host', 'name username').lean()
  if (!event) return response.status(404).json({ message: 'This event could not be found.' })
  response.json({ invite: { event, expiresAt: invite.inviteExpiresAt } })
}

export async function acceptInvite(request: Request, response: Response) {
  const invite = await Registration.findOne({ inviteTokenHash: hashInviteToken(String(request.params.token)), type: 'invited', status: 'pending' })
  if (!invite || !invite.inviteExpiresAt || invite.inviteExpiresAt.getTime() < Date.now()) {
    return response.status(410).json({ code: 'invite_expired', message: 'This invitation is no longer active. Ask the host to send it again.' })
  }
  const user = await User.findById(request.auth.sub)
  if (!user || user.email !== invite.inviteEmail) return response.status(403).json({ message: 'Sign in with the email address that received this invitation.' })
  const event = await Event.findOne({ _id: invite.event, status: 'published' })
  if (!event) return response.status(404).json({ message: 'This event is no longer open.' })
  if (String(event.host) === String(user.id)) return response.status(403).json({ message: 'Event organisers cannot register for their own event.' })

  const existingRegistration = await Registration.findOne({ user: user.id, event: event.id })
  if (existingRegistration && existingRegistration.status !== 'cancelled') return response.status(409).json({ message: 'You already have a registration for this event.' })
  const place = await Event.findOneAndUpdate(eventHasRoomFilter(event.id), { $inc: { registeredCount: 1 } }, { new: true })
  if (!place) return response.status(409).json({ code: 'event_full', message: 'This event is full. Contact the host for help.' })

  const ticketId = randomUUID()
  try {
    const acceptedFields = {
      type: 'invited' as const, status: 'confirmed' as const, ticketId, checkedIn: false, checkedInAt: null as Date | null,
      checkedInBy: null as string | null, acceptedAt: new Date(), user: user.id,
    }
    const registration = existingRegistration
      ? await Registration.findOneAndUpdate({ _id: existingRegistration.id, status: 'cancelled' }, { $set: acceptedFields, $unset: { inviteTokenHash: 1, inviteExpiresAt: 1, inviteEmail: 1 } }, { new: true })
      : await Registration.findOneAndUpdate({ _id: invite.id, status: 'pending' }, { $set: acceptedFields, $unset: { inviteTokenHash: 1, inviteExpiresAt: 1 } }, { new: true })
    if (!registration) {
      await Event.updateOne({ _id: event.id }, { $inc: { registeredCount: -1 } })
      return response.status(409).json({ message: 'This invitation was already accepted.' })
    }
    if (existingRegistration) await invite.deleteOne()
    let emailSent = true
    try {
      await sendRegistrationConfirmation({ email: user.email, name: user.name, eventTitle: event.title, eventId: event.id, startDate: event.startDate, venue: event.venue, ticketId, type: 'invited' })
    } catch (error) {
      emailSent = false
      console.error('Could not send invite acceptance confirmation:', error)
    }
    response.json({ registration: { _id: registration.id }, emailSent })
  } catch (error) {
    await Event.updateOne({ _id: event.id }, { $inc: { registeredCount: -1 } })
    throw error
  }
}
