import { BrevoClient } from '@getbrevo/brevo'
import type { Brevo } from '@getbrevo/brevo'
import QRCode from 'qrcode'
import { createQrToken } from '../utils/qr-token.js'

type EmailAttachment = { name: string; content: string }

export async function sendEmail(to: string, name: string, subject: string, htmlContent: string, attachment?: EmailAttachment, textContent?: string) {
  const apiKey = process.env.BREVO_API_KEY
  const senderEmail = process.env.BREVO_SENDER_EMAIL
  const senderName = process.env.BREVO_SENDER_NAME || 'Vista Events'
  if (!apiKey || !senderEmail) throw new Error('Brevo is not configured. Set BREVO_API_KEY and BREVO_SENDER_EMAIL.')

  const request: Brevo.SendTransacEmailRequest = {
    sender: { name: senderName, email: senderEmail },
    to: [{ email: to, ...(name ? { name } : {}) }],
    subject,
    htmlContent,
    ...(textContent ? { textContent } : {}),
    ...(attachment ? { attachment: [attachment] } : {}),
  }

  const client = new BrevoClient({ apiKey, timeoutInSeconds: 15, maxRetries: 1 })
  return client.transactionalEmails.sendTransacEmail(request)
}

type ConfirmationDetails = {
  email: string
  name: string
  eventTitle: string
  eventId: string
  startDate: Date
  venue: string
  ticketId: string
  type: 'registered' | 'invited'
}

export async function sendRegistrationConfirmation(details: ConfirmationDetails) {
  const token = createQrToken({ ticketId: details.ticketId, eventId: details.eventId, type: details.type })
  const png = await QRCode.toBuffer(token, { errorCorrectionLevel: 'M', margin: 1, width: 360 })
  const escape = (value: string) => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] || character)
  const title = escape(details.eventTitle)
  const name = escape(details.name)
  const date = details.startDate.toLocaleString()
  const venue = escape(details.venue)
  const html = `<html><body style="font-family:Arial,sans-serif;color:#242820;line-height:1.6"><p>Hi ${name},</p><p>Your registration for <strong>${title}</strong> is confirmed.</p><p><strong>When:</strong> ${escape(date)}<br><strong>Where:</strong> ${venue}</p><p>Your Vista entry ticket is attached. Please show the QR code when you arrive.</p><p>See you there,<br>Vista Events</p></body></html>`
  const text = `Hi ${details.name},\n\nYour registration for ${details.eventTitle} is confirmed.\n\nWhen: ${date}\nWhere: ${details.venue}\n\nYour Vista entry ticket is attached. Please show the QR code when you arrive.\n\nSee you there,\nVista Events`
  return sendEmail(details.email, details.name, `Your ticket for ${details.eventTitle}`, html, { name: 'vista-entry-ticket.png', content: png.toString('base64') }, text)
}

export async function sendTeamRegistrationRequest(details: { email: string; eventTitle: string; teamName: string; leaderName: string; acceptUrl: string; expiresAt: Date }) {
  const escape = (value: string) => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] || character)
  const teamName = escape(details.teamName)
  const eventTitle = escape(details.eventTitle)
  const expiry = details.expiresAt.toLocaleString()
  const html = `<html><body style="font-family:Arial,sans-serif;color:#242820;line-height:1.6"><p>Hi,</p><p>${escape(details.leaderName)} invited you to join <strong>${teamName}</strong> for <strong>${eventTitle}</strong>.</p><p>Please sign in with this email address and accept the request before ${escape(expiry)}.</p><p><a href="${escape(details.acceptUrl)}">Review and accept the team request</a></p><p>The team registration is confirmed after every member accepts and the event has enough places for the full team.</p><p>Thanks,<br>Vista Events</p></body></html>`
  const text = `Hi,\n\n${details.leaderName} invited you to join ${details.teamName} for ${details.eventTitle}.\n\nSign in with this email address and accept before ${expiry}:\n${details.acceptUrl}\n\nThe team registration is confirmed after every member accepts and the event has enough places for the full team.\n\nThanks,\nVista Events`
  return sendEmail(details.email, '', `Join ${details.teamName} for ${details.eventTitle}`, html, undefined, text)
}
