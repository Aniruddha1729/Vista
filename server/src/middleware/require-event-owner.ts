import type { NextFunction, Request, Response } from 'express'
import { Event } from '../models/event.model.js'

export async function requireEventOwner(request: Request, response: Response, next: NextFunction) {
  const event = await Event.findById(request.params.id)
  if (!event) return response.status(404).json({ message: 'Event not found.' })
  if (event.host.toString() !== request.auth.sub) return response.status(403).json({ message: 'Only the event host can change staff or delete this event.' })
  request.event = event
  next()
}
