import type { Request, Response } from 'express'
import { randomUUID } from 'node:crypto'
import QRCode from 'qrcode'
import { Registration } from '../models/registration.model.js'
import { createQrToken } from '../utils/qr-token.js'

export async function getRegistrationQr(request: Request, response: Response) {
  const registration = await Registration.findOne({ _id: request.params.id, user: request.auth.sub }).select('+ticketId')
  if (!registration) return response.status(404).json({ message: 'Ticket not found.' })
  if (registration.status !== 'confirmed') return response.status(409).json({ message: 'This registration is cancelled.' })
  if (!registration.ticketId) {
    registration.ticketId = randomUUID()
    await registration.save()
  }

  const token = createQrToken({ ticketId: registration.ticketId, eventId: registration.event.toString(), type: registration.type })
  const qrDataUrl = await QRCode.toDataURL(token, { errorCorrectionLevel: 'M', margin: 1, width: 320 })
  response.json({ qrDataUrl })
}
