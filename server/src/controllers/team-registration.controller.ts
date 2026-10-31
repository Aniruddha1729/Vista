import { createHash, randomUUID } from 'node:crypto'
import type { Request, Response } from 'express'
import type { Types } from 'mongoose'
import { Event } from '../models/event.model.js'
import { Registration } from '../models/registration.model.js'
import { TeamRegistration } from '../models/team-registration.model.js'
import type { TeamRegistrationDocument, TeamRegistrationMember } from '../models/team-registration.model.js'
import { User } from '../models/user.model.js'
import { sendRegistrationConfirmation } from '../services/email.js'

export async function getTeamInvitation(request: Request, response: Response) {
  const tokenHash = createHash('sha256').update(String(request.params.token || '')).digest('hex')
  const team = await TeamRegistration.findOne({ 'members.tokenHash': tokenHash }).populate('event', 'title startDate venue')
  if (!team || team.expiresAt <= new Date() || team.status === 'expired') {
    if (team?.status === 'pending' && team.expiresAt <= new Date()) {
      team.status = 'expired'
      await team.save()
    }
    return response.status(410).json({ message: 'This team request is invalid or has expired.' })
  }
  const member = team.members.find((entry) => entry.tokenHash === tokenHash)
  const leader = await User.findById(team.leader).select('name')
  response.json({ invitation: { event: team.event, teamName: team.teamName, teamSize: team.teamSize, leaderName: leader?.name || 'A teammate', invitedEmail: member?.email, memberStatus: member?.status, status: team.status, expiresAt: team.expiresAt } })
}

export async function acceptTeamRequest(request: Request, response: Response) {
  const tokenHash = createHash('sha256').update(String(request.params.token || '')).digest('hex')
  const team = await TeamRegistration.findOne({ 'members.tokenHash': tokenHash })
  if (!team) return response.status(404).json({ message: 'This team request is invalid or has expired.' })
  if (team.status === 'confirmed') return response.json({ status: 'confirmed', message: 'Your team registration is confirmed. Your ticket is available under My events.' })
  if (team.status !== 'pending' || team.expiresAt <= new Date()) {
    if (team.status === 'pending') {
      team.status = 'expired'
      await team.save()
    }
    return response.status(410).json({ message: 'This team request has expired or is no longer active.' })
  }

  const member = team.members.find((entry) => entry.tokenHash === tokenHash)
  const user = await User.findById(request.auth.sub).select('name email emailVerified')
  if (!member || !user) return response.status(404).json({ message: 'Team request or account could not be found.' })
  if (!user.emailVerified) return response.status(403).json({ message: 'Verify your email before accepting a team request.' })
  if (user.email.toLowerCase() !== member.email.toLowerCase()) return response.status(403).json({ message: `Sign in with ${member.email} to accept this team request.` })
  const event = await Event.findById(team.event).select('host')
  if (event && String(event.host) === String(user._id)) return response.status(403).json({ message: 'Event organisers cannot register for their own event.' })
  return acceptTeamMember(team, member, user, response)
}

export async function acceptTeamById(request: Request, response: Response) {
  const [team, user] = await Promise.all([
    TeamRegistration.findById(request.params.teamId),
    User.findById(request.auth.sub).select('name email emailVerified'),
  ])
  if (!team || !user) return response.status(404).json({ message: 'Team request or account could not be found.' })
  if (!user.emailVerified) return response.status(403).json({ message: 'Verify your email before accepting a team request.' })
  const member = team.members.find((entry) => entry.email.toLowerCase() === user.email.toLowerCase())
  if (!member) return response.status(403).json({ message: 'This team invitation belongs to a different email address.' })
  const event = await Event.findById(team.event).select('host')
  if (event && String(event.host) === String(user._id)) return response.status(403).json({ message: 'Event organisers cannot register for their own event.' })
  return acceptTeamMember(team, member, user, response)
}

async function acceptTeamMember(team: TeamRegistrationDocument, member: TeamRegistrationMember, user: { _id: Types.ObjectId; email: string; emailVerified?: boolean }, response: Response) {
  const userId = user._id.toString()
  if (team.status === 'confirmed') return response.json({ status: 'confirmed', message: 'Your team registration is confirmed. Your ticket is available under Registered events.' })
  if (team.status !== 'pending' || team.expiresAt <= new Date()) {
    if (team.status === 'pending') {
      team.status = 'expired'
      await team.save()
    }
    return response.status(410).json({ message: 'This team request has expired or is no longer active.' })
  }
  const existingRegistration = await Registration.exists({ user: userId, event: team.event, status: { $ne: 'cancelled' } })
  if (existingRegistration) return response.status(409).json({ message: 'You already registered for this event. Ask the team leader to invite a different teammate.' })
  if (member.status === 'accepted' && member.user?.toString() !== userId) return response.status(409).json({ message: 'This invitation was already accepted by another account.' })

  if (member.status !== 'accepted') {
    member.status = 'accepted'
    member.user = user._id
    member.acceptedAt = new Date()
    await team.save()
  }
  const acceptedCount = team.members.filter((entry) => entry.status === 'accepted').length
  if (acceptedCount < team.members.length) {
    return response.json({ status: 'pending', acceptedCount, teamSize: team.teamSize, message: `You’re in. Waiting for ${team.members.length - acceptedCount} teammate(s) to accept.` })
  }

  // Claim finalization once, then reserve every seat together.
  const completingTeam = await TeamRegistration.findOneAndUpdate(
    { _id: team._id, status: 'pending', expiresAt: { $gt: new Date() }, members: { $not: { $elemMatch: { status: { $ne: 'accepted' } } } } },
    { $set: { status: 'processing' } },
    { new: true },
  )
  if (!completingTeam) {
    const latest = await TeamRegistration.findById(team._id)
    if (latest?.status === 'confirmed') return response.json({ status: 'confirmed', message: 'Your team registration is confirmed. Your ticket is available under My events.' })
    return response.status(409).json({ message: 'Your acceptance is saved. The team is being confirmed; refresh this page in a moment.' })
  }

  const event = await Event.findOneAndUpdate(
    { _id: team.event, status: 'published', $expr: { $lte: [{ $add: ['$registeredCount', team.teamSize] }, '$capacity'] } },
    { $inc: { registeredCount: team.teamSize } },
    { new: true },
  )
  if (!event) {
    await TeamRegistration.updateOne({ _id: team._id, status: 'processing' }, { $set: { status: 'capacity_full' } })
    return response.status(409).json({ code: 'event_full', message: 'Everyone accepted, but there are not enough places left for the whole team. Ask the leader to contact the host.' })
  }

  const leader = await User.findById(team.leader).select('_id name email emailVerified')
  const members = await User.find({ _id: { $in: completingTeam.members.map((entry) => entry.user) } }).select('_id name email emailVerified')
  const attendees = [...(leader ? [leader] : []), ...members]
  if (attendees.length !== team.teamSize || attendees.some((attendee) => !attendee.emailVerified)) {
    await Event.updateOne({ _id: event.id }, { $inc: { registeredCount: -team.teamSize } })
    await TeamRegistration.updateOne({ _id: team._id, status: 'processing' }, { $set: { status: 'capacity_full' } })
    return response.status(409).json({ message: 'A team account is unavailable. Ask the team leader to contact the host.' })
  }

  const registrations = attendees.map((attendee) => ({
    user: attendee.id,
    event: event.id,
    teamRegistration: team._id,
    teamName: team.teamName,
    teamLeader: team.leader,
    type: 'registered' as const,
    status: 'confirmed' as const,
    ticketId: randomUUID(),
    formData: { ...team.formData, teamName: team.teamName, teamSize: team.teamSize },
  }))
  try {
    const created = await Registration.insertMany(registrations)
    for (const memberEntry of completingTeam.members) {
      const registration = created.find((entry) => entry.user.toString() === memberEntry.user?.toString())
      if (registration) memberEntry.registration = registration.id
    }
    completingTeam.status = 'confirmed'
    await completingTeam.save()
    await Promise.allSettled(created.map((registration) => {
      const attendee = attendees.find((entry) => entry.id === registration.user.toString())
      if (!attendee) return Promise.resolve()
      return sendRegistrationConfirmation({ email: attendee.email, name: attendee.name, eventTitle: event.title, eventId: event.id, startDate: event.startDate, venue: event.venue, ticketId: registration.ticketId, type: 'registered' })
    }))
  } catch (error) {
    await Registration.deleteMany({ teamRegistration: team._id })
    await Event.updateOne({ _id: event.id }, { $inc: { registeredCount: -team.teamSize } })
    await TeamRegistration.updateOne({ _id: team._id, status: 'processing' }, { $set: { status: 'capacity_full' } })
    throw error
  }

  response.json({ status: 'confirmed', message: 'Your team is registered. Your ticket is available under My events.' })
}
