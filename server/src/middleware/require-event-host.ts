import { Event } from '../models/event.model.js'
import type { NextFunction, Request, Response } from 'express'

export async function requireEventHost(request: Request, response: Response, next: NextFunction) {
  const event = await Event.findById(request.params.id)
  if (!event) return response.status(404).json({ message: 'Event not found.' })
  const userId = request.auth.sub
  const isHost = event.host.toString() === userId
  const isCoHost = event.coHosts.some((coHost) => coHost.toString() === userId)
  if (!isHost && !isCoHost) return response.status(403).json({ message: 'Only this event’s host or staff can do that.' })
  request.event = event
  next()
}
