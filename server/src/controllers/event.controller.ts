import { createHash, randomBytes, randomUUID } from 'node:crypto'
import type { Request, Response } from 'express'
import QRCode from 'qrcode'
import { z } from 'zod'
import { Event } from '../models/event.model.js'
import { Registration } from '../models/registration.model.js'
import { TeamRegistration } from '../models/team-registration.model.js'
import { SavedEvent } from '../models/saved-event.model.js'
import { User } from '../models/user.model.js'
import { eventHasRoomFilter } from '../utils/capacity.js'
import { verifyQrToken } from '../utils/qr-token.js'
import { sendRegistrationConfirmation, sendTeamRegistrationRequest } from '../services/email.js'
import { hasProTier } from '../utils/user-plan.js'

export const eventInput = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(10).max(5000),
  category: z.string().trim().min(2).max(50),
  poster: z.url().optional().or(z.literal('')),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
  registrationDeadline: z.coerce.date().optional(),
  venue: z.string().trim().min(2).max(200),
  mode: z.enum(['In person', 'Online', 'Hybrid']).default('In person'),
  capacity: z.coerce.number().int().min(1).max(100000).default(100),
  price: z.string().trim().max(80).default('Free'),
  priceAmountPaise: z.coerce.number().int().min(0).max(100000000000).default(0),
  priceUnit: z.enum(['individual', 'team']).default('individual'),
  platformFeePayer: z.enum(['organiser', 'applicant']).default('organiser'),
  status: z.enum(['draft', 'published', 'cancelled']).default('draft'),
  eligibility: z.string().max(1000).optional(),
  minTeamSize: z.coerce.number().int().min(1).max(6).default(1),
  maxTeamSize: z.coerce.number().int().min(1).max(6).default(1),
  tags: z.array(z.string().max(40)).max(20).default([]),
  overview: z.string().max(5000).optional(),
  prizes: z.array(z.string().max(200)).max(10).default([]),
  inviteTemplate: z.enum(['minimal', 'bold-gradient', 'dark-neon', 'formal']).default('minimal'),
  inviteMessage: z.string().trim().max(1000).default('We would love to see you there.'),
  registrationTemplate: z.enum(['vista', 'editorial', 'electric', 'midnight', 'botanical', 'studio', 'summit', 'minimal']).default('vista'),
})

function makeSlug(title: string) {
  const base = title.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70)
  return `${base}-${randomBytes(3).toString('hex')}`
}

export async function listEvents(request: Request, response: Response) {
  const filter: { status: string; category?: string; $text?: { $search: string } } = { status: 'published' }
  if (request.query.category) filter.category = String(request.query.category)
  if (request.query.search) filter.$text = { $search: String(request.query.search) }
  const events = await Event.find(filter).populate('host', 'name username').sort({ startDate: 1 }).lean()
  response.json({ events })
}

export async function myHostedEvents(request: Request, response: Response) {
  const events = await Event.find({ $or: [{ host: request.auth.sub }, { coHosts: request.auth.sub }] })
    .populate('host', 'name username')
    .sort({ startDate: 1 })
    .lean()
  response.json({ events })
}

export async function eventDiscovery(_request: Request, response: Response) {
  const [categories, publishedEvents, registeredPlaces] = await Promise.all([
    Event.distinct('category', { status: 'published' }),
    Event.countDocuments({ status: 'published' }),
    Event.aggregate([{ $match: { status: 'published' } }, { $group: { _id: null, total: { $sum: '$registeredCount' } } }]),
  ])
  response.json({ categories: categories.filter((category): category is string => typeof category === 'string').sort((left, right) => left.localeCompare(right)), publishedEvents, registeredPlaces: registeredPlaces[0]?.total || 0 })
}

export async function getEvent(request: Request, response: Response) {
  const eventParam = request.params.slug
  const eventKey = Array.isArray(eventParam) ? eventParam[0] || '' : eventParam
  const lookup = /^[a-f\d]{24}$/i.test(eventKey)
    ? { _id: eventKey, status: 'published' }
    : { slug: eventKey, status: 'published' }
  const event = await Event.findOne(lookup).populate('host', 'name username plan proExpiresAt').lean()
  if (!event) return response.status(404).json({ message: 'This event could not be found.' })
  if (!hasProTier(event.host as { plan?: 'free' | 'pro'; proExpiresAt?: Date | null } | null)) event.registrationTemplate = 'vista'
  response.json({ event })
}

export async function resolveShareLink(request: Request, response: Response) {
  const event = await Event.findOne({ shareToken: request.params.token, status: 'published' }).select('_id title')
  if (!event) return response.status(404).json({ code: 'link_expired', message: 'This event link has expired. Ask the host for a new one.' })
  response.json({ id: event.id })
}

export async function getManageEvent(request: Request, response: Response) {
  if (!request.event.shareToken) {
    request.event.shareToken = randomUUID()
    await request.event.save()
  }
  await request.event.populate([{ path: 'host', select: 'name username' }, { path: 'coHosts', select: 'name username email' }])
  response.json({ event: request.event })
}

export async function getEventPreview(request: Request, response: Response) {
  await request.event.populate('host', 'name username')
  response.json({ event: request.event })
}

export async function regenerateShareToken(request: Request, response: Response) {
  request.event.shareToken = randomUUID()
  await request.event.save()
  response.json({ shareToken: request.event.shareToken })
}

export async function getShareQr(request: Request, response: Response) {
  if (request.event.status !== 'published') return response.status(409).json({ code: 'event_not_public', message: 'Make this event public before sharing its event link or QR code.' })
  if (!request.event.shareToken) {
    request.event.shareToken = randomUUID()
    await request.event.save()
  }
  const clientUrl = (process.env.CLIENT_URL || '').split(',')[0].trim().replace(/\/$/, '')
  const publicUrl = `${clientUrl}/e/${request.event.shareToken}`
  const qrDataUrl = await QRCode.toDataURL(publicUrl, { errorCorrectionLevel: 'M', margin: 1, width: 320 })
  response.json({ publicUrl, qrDataUrl })
}

export async function addCoHost(request: Request, response: Response) {
  const parsed = z.object({ email: z.email() }).safeParse(request.body)
  if (!parsed.success) return response.status(400).json({ message: 'Enter a valid staff email address.' })
  const coHost = await User.findOne({ email: parsed.data.email.toLowerCase() }).select('_id name username email')
  if (!coHost) return response.status(404).json({ message: 'No Vista account found for that email.' })
  if (coHost.id === request.auth.sub) return response.status(400).json({ message: 'The event host already has full access.' })
  const actor = await User.findById(request.auth.sub).select('plan proExpiresAt')
  const filter = hasProTier(actor)
    ? { _id: request.event.id }
    : { _id: request.event.id, coHosts: { $ne: coHost.id }, $expr: { $lt: [{ $size: '$coHosts' }, 5] } }
  const updated = await Event.updateOne(filter, { $addToSet: { coHosts: coHost.id } })
  if (!updated.matchedCount) {
    const alreadyStaff = await Event.exists({ _id: request.event.id, coHosts: coHost.id })
    if (!alreadyStaff) return response.status(403).json({ code: 'pro_required', message: 'Free plan includes up to 5 event staff members. Upgrade to Pro for unlimited permissions.' })
  }
  response.status(201).json({ staff: coHost })
}

export async function removeCoHost(request: Request, response: Response) {
  await Event.updateOne({ _id: request.event.id }, { $pull: { coHosts: request.params.userId } })
  response.status(204).end()
}

export async function createEvent(request: Request, response: Response) {
  const parsed = eventInput.safeParse(request.body)
  if (!parsed.success) return response.status(400).json({ message: 'Check the event details and try again.', errors: parsed.error.flatten() })
  if (parsed.data.priceAmountPaise > 0 && parsed.data.priceUnit === 'team') return response.status(400).json({ message: 'Paid team fees are not enabled yet. Choose an individual fee for now.' })
  if (parsed.data.minTeamSize > parsed.data.maxTeamSize) return response.status(400).json({ message: 'Minimum team size cannot exceed maximum team size.' })
  if (parsed.data.registrationTemplate !== 'vista' || parsed.data.inviteTemplate !== 'minimal') {
    const actor = await User.findById(request.auth.sub).select('plan proExpiresAt')
    if (!hasProTier(actor)) return response.status(403).json({ code: 'pro_required', message: 'Premium event and invitation styles are available with Pro. Upgrade to create an event with those designs.' })
  }
  const event = await Event.create({ ...parsed.data, slug: makeSlug(parsed.data.title), shareToken: randomUUID(), host: request.auth.sub })
  await event.populate('host', 'name username')
  response.status(201).json({ event })
}

export async function updateEvent(request: Request, response: Response) {
  const parsed = eventInput.partial().safeParse(request.body)
  if (!parsed.success) return response.status(400).json({ message: 'Check the event details and try again.', errors: parsed.error.flatten() })
  if (parsed.data.priceAmountPaise !== undefined && parsed.data.priceAmountPaise > 0 && parsed.data.priceUnit === 'team') return response.status(400).json({ message: 'Paid team fees are not enabled yet. Choose an individual fee for now.' })
  if (parsed.data.minTeamSize !== undefined && parsed.data.maxTeamSize !== undefined && parsed.data.minTeamSize > parsed.data.maxTeamSize) return response.status(400).json({ message: 'Minimum team size cannot exceed maximum team size.' })
  if (parsed.data.registrationTemplate && parsed.data.registrationTemplate !== 'vista') {
    const actor = await User.findById(request.auth.sub).select('plan proExpiresAt')
    if (!hasProTier(actor)) return response.status(403).json({ code: 'pro_required', message: 'Registration page styles are a Pro feature. Upgrade to Pro to unlock them.' })
  }
  if (parsed.data.inviteTemplate && parsed.data.inviteTemplate !== 'minimal') {
    const actor = await User.findById(request.auth.sub).select('plan proExpiresAt')
    if (!hasProTier(actor)) return response.status(403).json({ code: 'pro_required', message: 'This invitation template is locked on the Free plan. Upgrade to Pro to unlock premium designs.' })
  }
  if (Object.keys(parsed.data).length === 0) return response.status(400).json({ message: 'Send at least one event detail to update.' })
  const event = await Event.findByIdAndUpdate(request.params.id, parsed.data, { new: true, runValidators: true }).populate('host', 'name username')
  response.json({ event })
}

export async function deleteEvent(request: Request, response: Response) {
  await TeamRegistration.deleteMany({ event: request.params.id })
  await Registration.deleteMany({ event: request.params.id })
  await SavedEvent.deleteMany({ event: request.params.id })
  await request.event.deleteOne()
  response.status(204).end()
}

export async function createTeamRegistration(request: Request, response: Response) {
  const parsed = z.object({
    teamName: z.string().trim().min(2).max(100),
    teamSize: z.coerce.number().int().min(2).max(6),
    formData: z.record(z.string(), z.union([z.string().max(5000), z.number(), z.boolean()])).default({}),
    memberEmails: z.array(z.email()).min(1).max(5),
  }).safeParse(request.body)
  if (!parsed.success) return response.status(400).json({ message: 'Check the team name, size, and member email addresses.' })

  const event = await Event.findOne({ _id: request.params.id, status: 'published' })
  if (!event) return response.status(404).json({ message: 'Event not found.' })
  if (event.priceAmountPaise > 0) return response.status(400).json({ message: 'Paid team registration is not available yet. This event currently accepts paid individual registrations only.' })
  if (String(event.host) === String(request.auth.sub)) return response.status(403).json({ message: 'Organisers cannot register for their own event.' })
  const minTeamSize = event.minTeamSize ?? 1
  const maxTeamSize = event.maxTeamSize ?? 1
  if (parsed.data.teamSize < minTeamSize || parsed.data.teamSize > maxTeamSize) {
    return response.status(400).json({ message: `This event accepts teams of ${minTeamSize === maxTeamSize ? minTeamSize : `${minTeamSize}–${maxTeamSize}`} members.` })
  }
  if (parsed.data.memberEmails.length !== parsed.data.teamSize - 1) {
    return response.status(400).json({ message: 'Enter one email address for each teammate besides yourself.' })
  }

  const leader = await User.findById(request.auth.sub).select('name email')
  if (!leader) return response.status(404).json({ message: 'Account not found.' })
  const emails = parsed.data.memberEmails.map((email) => email.toLowerCase().trim())
  if (emails.some((email) => email === leader.email) || new Set(emails).size !== emails.length) {
    return response.status(400).json({ message: 'Use a different email for each teammate. Your own email is already the team leader.' })
  }
  const activeRegistration = await Registration.findOne({ user: leader.id, event: event.id, status: { $ne: 'cancelled' } })
  if (activeRegistration) return response.status(409).json({ message: 'You already have a registration for this event.' })
  const registeredMembers = await User.find({ email: { $in: emails } }).select('_id')
  const alreadyOnEvent = await Registration.exists({ user: { $in: registeredMembers.map((member) => member.id) }, event: event.id, status: { $ne: 'cancelled' } })
  if (alreadyOnEvent) return response.status(409).json({ message: 'One of those teammates is already registered for this event.' })

  const now = new Date()
  const expiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1000)
  const rawTokens = emails.map(() => randomBytes(32).toString('base64url'))
  const team = await TeamRegistration.create({
    event: event.id,
    leader: leader.id,
    teamName: parsed.data.teamName,
    teamSize: parsed.data.teamSize,
    expiresAt,
    formData: parsed.data.formData,
    members: emails.map((email, index) => ({ email, tokenHash: createHash('sha256').update(rawTokens[index]).digest('hex') })),
  })

  const clientUrl = (process.env.CLIENT_URL || '').split(',')[0].trim().replace(/\/$/, '')
  const sends = await sendTeamRegistrationEmails(emails, {
    eventTitle: event.title,
    teamName: team.teamName,
    leaderName: leader.name,
    expiresAt,
  }, (index) => `${clientUrl}/team-invites/${rawTokens[index]}`)
  const failed = sends.filter((result) => result.status === 'rejected').length
  response.status(201).json({
    teamRegistration: { id: team.id, teamName: team.teamName, teamSize: team.teamSize, status: team.status, expiresAt, members: team.members.map((member) => ({ email: member.email, status: member.status })) },
    emailSent: failed === 0,
    message: failed ? 'Your team request was saved, but some invitation emails could not be sent. Check Brevo settings before retrying.' : 'Team request sent. Your teammates need to accept within 48 hours.',
  })
}

export async function sendTeamRegistrationEmails(emails: string[], details: { eventTitle: string; teamName: string; leaderName: string; expiresAt: Date }, acceptUrlFor: (index: number) => string, sender: (details: { email: string; eventTitle: string; teamName: string; leaderName: string; acceptUrl: string; expiresAt: Date }) => Promise<unknown> = sendTeamRegistrationRequest) {
  return Promise.allSettled(emails.map((email, index) => sender({ ...details, email, acceptUrl: acceptUrlFor(index) })))
}

export async function registerForEvent(request: Request, response: Response) {
  const event = await Event.findOne({ _id: request.params.id, status: 'published' })
  if (!event) return response.status(404).json({ message: 'Event not found.' })
  if (String(event.host) === String(request.auth.sub)) return response.status(403).json({ message: 'Organisers cannot register for their own event.' })
  const existing = await Registration.findOne({ user: request.auth.sub, event: event.id })
  if (existing && existing.status !== 'cancelled') return response.status(409).json({ message: 'You already have a registration for this event.' })
  if ((event.minTeamSize ?? 1) > 1) return response.status(400).json({ message: `This event requires teams of at least ${event.minTeamSize} people. Start a team registration to invite your teammates.` })
  if (event.priceAmountPaise > 0) return response.status(402).json({ code: 'payment_required', message: 'Complete payment before registering for this event.' })

  // Reserve one place with a single MongoDB update, so simultaneous requests cannot exceed capacity.
  const place = await Event.findOneAndUpdate(
    eventHasRoomFilter(event.id),
    { $inc: { registeredCount: 1 } },
    { new: true },
  )
  if (!place) return response.status(409).json({ message: 'This event is full.' })

  const ticketId = randomUUID()
  try {
    const registration = existing
      ? await Registration.findOneAndUpdate({ _id: existing.id, status: 'cancelled' }, { status: 'confirmed', type: 'registered', checkedIn: false, checkedInAt: null, checkedInBy: null, ticketId, formData: request.body?.formData || {} }, { new: true })
      : await Registration.create({ user: request.auth.sub, event: event.id, ticketId, formData: request.body?.formData || {} })
    if (!registration) {
      await Event.updateOne({ _id: event.id }, { $inc: { registeredCount: -1 } })
      return response.status(409).json({ message: 'You already have a registration for this event.' })
    }
    const user = await User.findById(request.auth.sub).select('name email')
    let emailSent = true
    try {
      if (user) await sendRegistrationConfirmation({ email: user.email, name: user.name, eventTitle: event.title, eventId: event.id, startDate: event.startDate, venue: event.venue, ticketId, type: 'registered' })
    } catch (emailError) {
      emailSent = false
      console.error('Could not send registration confirmation:', emailError)
    }
    response.status(existing ? 200 : 201).json({ registration: { _id: registration.id, status: registration.status, type: registration.type, createdAt: registration.createdAt }, emailSent })
  } catch (error: unknown) {
    await Event.updateOne({ _id: event.id }, { $inc: { registeredCount: -1 } })
    if (typeof error === 'object' && error && 'code' in error && error.code === 11000) return response.status(409).json({ message: 'You already have a registration for this event.' })
    throw error
  }
}

export async function cancelRegistration(request: Request, response: Response) {
  const existing = await Registration.findOne({ _id: request.params.registrationId, user: request.auth.sub, status: 'confirmed' })
  if (existing?.paymentId) return response.status(409).json({ message: 'Paid registrations cannot be cancelled online yet. Contact Vista support to discuss the event refund policy.' })
  const registration = await Registration.findOneAndUpdate(
    { _id: request.params.registrationId, user: request.auth.sub, status: 'confirmed' },
    { status: 'cancelled' },
    { new: true },
  )
  if (!registration) return response.status(404).json({ message: 'Active registration not found.' })
  await Event.updateOne({ _id: registration.event }, { $inc: { registeredCount: -1 } })
  response.json({ registration })
}

export async function saveEvent(request: Request, response: Response) {
  const event = await Event.findOne({ _id: request.params.id, status: 'published' })
  if (!event) return response.status(404).json({ message: 'Event not found.' })
  await SavedEvent.updateOne({ user: request.auth.sub, event: event.id }, { $setOnInsert: { user: request.auth.sub, event: event.id } }, { upsert: true })
  response.status(204).end()
}

export async function unsaveEvent(request: Request, response: Response) {
  await SavedEvent.deleteOne({ user: request.auth.sub, event: request.params.id })
  response.status(204).end()
}

export async function myRegistrations(request: Request, response: Response) {
  const registrations = await Registration.find({ user: request.auth.sub, status: { $ne: 'cancelled' } })
    .populate({ path: 'event', select: 'title slug category poster startDate venue mode price' })
    .populate({ path: 'teamLeader', select: 'name username' })
    .sort({ createdAt: -1 }).lean()
  response.json({ registrations })
}

export async function myTeamInvitations(request: Request, response: Response) {
  const user = await User.findById(request.auth.sub).select('email')
  if (!user) return response.status(404).json({ message: 'Account not found.' })
  await TeamRegistration.updateMany({ 'members.email': user.email, status: 'pending', expiresAt: { $lte: new Date() } }, { $set: { status: 'expired' } })
  const teams = await TeamRegistration.find({ 'members.email': user.email, status: { $in: ['pending', 'confirmed', 'capacity_full'] } })
    .populate('event', 'title slug startDate venue')
    .populate('leader', 'name username')
    .sort({ createdAt: -1 }).lean()
  response.json({ invitations: teams.map((team) => ({
    id: team._id,
    teamName: team.teamName,
    teamSize: team.teamSize,
    status: team.status,
    expiresAt: team.expiresAt,
    event: team.event,
    leader: team.leader,
    memberStatus: team.members.find((member) => member.email === user.email)?.status || 'pending',
  })) })
}

export async function savedEvents(request: Request, response: Response) {
  const saved = await SavedEvent.find({ user: request.auth.sub }).populate({ path: 'event', match: { status: 'published' }, populate: { path: 'host', select: 'name username' } }).sort({ createdAt: -1 }).lean()
  response.json({ events: saved.map((item) => item.event).filter(Boolean) })
}

export async function applicants(request: Request, response: Response) {
  const registrations = await Registration.find({ event: request.params.id }).populate('user', 'username email').sort({ createdAt: 1 }).lean()
  response.json({ registrations })
}

export async function scanRegistration(request: Request, response: Response) {
  const parsed = z.object({ token: z.string().min(1) }).safeParse(request.body)
  if (!parsed.success) return response.status(400).json({ code: 'invalid_signature', message: 'This QR code is not a valid Vista ticket.' })

  let ticket
  try {
    ticket = verifyQrToken(parsed.data.token)
  } catch {
    return response.status(400).json({ code: 'invalid_signature', message: 'This QR code is not a valid Vista ticket.' })
  }

  if (ticket.eventId !== request.event.id) return response.status(409).json({ code: 'wrong_event', message: 'This ticket belongs to a different event.' })
  const registration = await Registration.findOne({ ticketId: ticket.ticketId }).populate('user', 'name username')
  if (!registration) return response.status(404).json({ code: 'invalid_ticket', message: 'No registration was found for this ticket.' })
  if (registration.event.toString() !== request.event.id) return response.status(409).json({ code: 'wrong_event', message: 'This ticket belongs to a different event.' })
  if (registration.type !== ticket.type) return response.status(400).json({ code: 'invalid_signature', message: 'The ticket details do not match.' })
  if (registration.status === 'cancelled') return response.status(409).json({ code: 'cancelled', message: 'This registration was cancelled.' })
  if (registration.checkedIn) return response.status(409).json({ code: 'already_used', message: 'This ticket was already scanned.', checkedInAt: registration.checkedInAt })

  const checkedInAt = new Date()
  const checkedIn = await Registration.findOneAndUpdate(
    { _id: registration.id, status: 'confirmed', checkedIn: false },
    { checkedIn: true, checkedInAt, checkedInBy: request.auth.sub },
    { new: true },
  ).populate('user', 'name username')

  if (!checkedIn) {
    const latest = await Registration.findById(registration.id)
    if (latest?.status === 'cancelled') return response.status(409).json({ code: 'cancelled', message: 'This registration was cancelled.' })
    return response.status(409).json({ code: 'already_used', message: 'This ticket was already scanned.', checkedInAt: latest?.checkedInAt })
  }

  const attendee = checkedIn.user as unknown as { name: string; username: string }
  response.json({ name: attendee.name || attendee.username, type: checkedIn.type, status: checkedIn.status, checkedInAt: checkedIn.checkedInAt })
}
