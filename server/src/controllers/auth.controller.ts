import bcrypt from 'bcrypt'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import type { Response } from 'express'
import type { Request } from 'express'
import { z } from 'zod'
import { sendEmail } from '../services/email.js'
import { uploadAvatarToCloudinary } from '../services/cloudinary.js'
import { User } from '../models/user.model.js'
import { createAccessToken, createRefreshToken, refreshCookieOptions, verifyRefreshToken } from '../utils/tokens.js'

const signupSchema = z.object({
  name: z.string().trim().min(2).max(80),
  username: z.string().trim().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/),
  email: z.email(),
  password: z.string().min(8).max(72),
})
const loginSchema = z.object({ identifier: z.string().trim().min(1), password: z.string().min(1) })

type UserAccount = {
  id?: string
  _id: { toString: () => string }
  name: string
  username: string
  email: string
  role: 'student' | 'organizer' | 'admin'
  plan: 'free' | 'pro'
  avatarUrl?: string
  sidebarStyle: 'hover' | 'dock'
  emailVerified: boolean
  profile: Record<string, unknown>
}

function publicUser(user: UserAccount) {
  return {
    id: user.id || user._id.toString(),
    name: user.name,
    username: user.username,
    email: user.email,
    role: user.role,
    plan: user.plan,
    avatarUrl: user.avatarUrl,
    sidebarStyle: user.sidebarStyle,
    emailVerified: user.emailVerified,
    profile: user.profile,
  }
}

function sendSession(user: UserAccount, response: Response, status = 200) {
  const tokenUser = { id: user.id || user._id.toString(), role: user.role }
  response.cookie('refreshToken', createRefreshToken(tokenUser), refreshCookieOptions)
  response.status(status).json({ accessToken: createAccessToken(tokenUser), user: publicUser(user) })
}

export async function signup(request: Request, response: Response) {
  const parsed = signupSchema.safeParse(request.body)
  if (!parsed.success) return response.status(400).json({ message: 'Check your details and try again.', errors: parsed.error.flatten() })

  const { name, username, email, password } = parsed.data
  const existingUser = await User.findOne({ $or: [{ email: email.toLowerCase() }, { username: username.toLowerCase() }] })
  if (existingUser) return response.status(409).json({ message: 'That email or username is already in use.' })

  const passwordHash = await bcrypt.hash(password, 12)
  const verificationToken = randomBytes(32).toString('hex')
  const user = await User.create({
    name,
    username,
    email,
    passwordHash,
    emailVerified: false,
    emailVerificationTokenHash: createHash('sha256').update(verificationToken).digest('hex'),
    emailVerificationTokenExpiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
  })
  const verifyUrl = `${(process.env.CLIENT_URL || '').split(',')[0].trim().replace(/\/$/, '')}/verify-email?token=${verificationToken}`
  let message = 'Your account is ready. Check your email for the verification link.'
  try {
    await sendEmail(user.email, user.name, 'Verify your Vista account', `<html><body style="font-family:Arial,sans-serif;color:#222"><h1>Welcome to Vista, ${escapeHtml(user.name)}.</h1><p>Confirm your email address to sign in and register for events.</p><p><a href="${verifyUrl}">Verify my email</a></p><p>This link expires in 24 hours.</p></body></html>`)
  } catch (error) {
    console.error('Could not send signup verification email:', error)
    message = 'Your account was created, but the verification email could not be sent. Check the email settings or request a new link.'
  }
  response.status(201).json({ message, email: user.email })
}

export async function login(request: Request, response: Response) {
  const parsed = loginSchema.safeParse(request.body)
  if (!parsed.success) return response.status(400).json({ message: 'Enter your email or username and password.' })

  const { identifier, password } = parsed.data
  const value = identifier.toLowerCase()
  const user = await User.findOne({ $or: [{ email: value }, { username: value }] })
  const passwordMatches = user && await bcrypt.compare(password, user.passwordHash)
  if (!passwordMatches) return response.status(401).json({ message: 'Email/username or password is incorrect.' })
  if (!user.emailVerified) return response.status(403).json({ message: 'Verify your email before signing in. You can request a new verification link.' })

  sendSession(user, response)
}

export async function verifyEmail(request: Request, response: Response) {
  const parsed = z.object({ token: z.string().min(32).max(200) }).safeParse(request.body)
  if (!parsed.success) return response.status(400).json({ message: 'This verification link is invalid or expired.' })
  const tokenHash = createHash('sha256').update(parsed.data.token).digest('hex')
  const user = await User.findOneAndUpdate(
    { emailVerificationTokenHash: tokenHash, emailVerificationTokenExpiresAt: { $gt: new Date() }, emailVerified: false },
    { $set: { emailVerified: true }, $unset: { emailVerificationTokenHash: 1, emailVerificationTokenExpiresAt: 1 } },
    { new: true },
  )
  if (!user) return response.status(400).json({ message: 'This verification link is invalid or expired. Request a new one.' })
  response.json({ message: 'Email verified. You can now sign in.' })
}

export async function resendVerification(request: Request, response: Response) {
  const parsed = z.object({ email: z.email() }).safeParse(request.body)
  if (!parsed.success) return response.status(400).json({ message: 'Enter a valid email address.' })
  const user = await User.findOne({ email: parsed.data.email.toLowerCase(), emailVerified: false })
  if (!user) return response.status(202).json({ message: 'If that account needs verification, a new link will be sent.' })
  const verificationToken = randomBytes(32).toString('hex')
  user.emailVerificationTokenHash = createHash('sha256').update(verificationToken).digest('hex')
  user.emailVerificationTokenExpiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24)
  await user.save()
  const verifyUrl = `${(process.env.CLIENT_URL || '').split(',')[0].trim().replace(/\/$/, '')}/verify-email?token=${verificationToken}`
  try {
    await sendEmail(user.email, user.name, 'Verify your Vista account', `<html><body style="font-family:Arial,sans-serif;color:#222"><h1>Verify your Vista account</h1><p><a href="${verifyUrl}">Verify my email</a></p><p>This link expires in 24 hours.</p></body></html>`)
  } catch (error) {
    console.error('Could not resend signup verification email:', error)
    return response.status(502).json({ message: 'Could not send a verification email. Check the Brevo email settings and try again.' })
  }
  response.status(202).json({ message: 'If that account needs verification, a new link will be sent.' })
}

export async function refresh(request: Request, response: Response) {
  try {
    const payload = verifyRefreshToken(request.cookies.refreshToken || '')
    const user = await User.findById(payload.sub)
    if (!user) throw new Error('Account not found')
    if (!user.emailVerified) throw new Error('Email address is not verified')
    sendSession(user, response)
  } catch {
    response.clearCookie('refreshToken', refreshCookieOptions)
    response.status(401).json({ message: 'Please log in again.' })
  }
}

export function logout(_request: Request, response: Response) {
  response.clearCookie('refreshToken', refreshCookieOptions)
  response.status(204).end()
}

export async function me(request: Request, response: Response) {
  const user = await User.findById(request.auth.sub)
  if (!user) return response.status(404).json({ message: 'Account not found.' })
  response.json({ user: publicUser(user) })
}

const profileSchema = z.object({
  name: z.string().trim().min(2).max(80),
  profile: z.object({
    phone: z.string().max(40).optional(),
    gender: z.string().max(40).optional(),
    dob: z.coerce.date().optional(),
    college: z.string().max(120).optional(),
    degree: z.string().max(100).optional(),
    branch: z.string().max(120).optional(),
    graduationYear: z.number().int().min(1950).max(2100).optional(),
    city: z.string().max(80).optional(),
    state: z.string().max(80).optional(),
    skills: z.array(z.string().trim().min(1).max(40)).max(50).optional(),
    bio: z.string().max(1000).optional(),
    linkedin: z.url().or(z.literal('')).optional(),
    github: z.url().or(z.literal('')).optional(),
    portfolio: z.url().or(z.literal('')).optional(),
  }),
})

export async function updateProfile(request: Request, response: Response) {
  const parsed = profileSchema.safeParse(request.body)
  if (!parsed.success) return response.status(400).json({ message: 'Check your profile details and try again.', errors: parsed.error.flatten() })
  const user = await User.findByIdAndUpdate(request.auth.sub, parsed.data, { new: true, runValidators: true })
  if (!user) return response.status(404).json({ message: 'Account not found.' })
  response.json({ user: publicUser(user) })
}

export async function updateSettings(request: Request, response: Response) {
  const parsed = z.object({ sidebarStyle: z.enum(['hover', 'dock']) }).safeParse(request.body)
  if (!parsed.success) return response.status(400).json({ message: 'Choose one of the available navigation styles.' })
  const user = await User.findByIdAndUpdate(request.auth.sub, parsed.data, { new: true })
  if (!user) return response.status(404).json({ message: 'Account not found.' })
  response.json({ user: publicUser(user) })
}

export async function updateAvatar(request: Request, response: Response) {
  if (!request.file) return response.status(400).json({ message: 'Choose a JPG, PNG, or WebP profile photo.' })
  const upload = await uploadAvatarToCloudinary(request.file, request.auth.sub)
  const user = await User.findByIdAndUpdate(request.auth.sub, { avatarUrl: upload.secure_url }, { new: true })
  if (!user) return response.status(404).json({ message: 'Account not found.' })
  response.json({ user: publicUser(user) })
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] || character)
}

export async function reportIssue(request: Request, response: Response) {
  const parsed = z.object({ subject: z.string().trim().min(3).max(150), description: z.string().trim().min(10).max(5000) }).safeParse(request.body)
  if (!parsed.success) return response.status(400).json({ message: 'Enter a subject and a description of at least 10 characters.' })
  const recipient = process.env.REPORT_ISSUE_TO_EMAIL
  if (!recipient) return response.status(503).json({ message: 'Issue reporting is not configured yet.' })
  const user = await User.findById(request.auth.sub).select('name email')
  if (!user) return response.status(404).json({ message: 'Account not found.' })
  const subject = `[Vista issue] ${parsed.data.subject}`
  const html = `<html><body style="font-family:Arial,sans-serif;color:#222"><h2>${escapeHtml(parsed.data.subject)}</h2><p><strong>From:</strong> ${escapeHtml(user.name)} &lt;${escapeHtml(user.email)}&gt;</p><p style="white-space:pre-wrap">${escapeHtml(parsed.data.description)}</p></body></html>`
  const screenshot = request.file
  try {
    await sendEmail(recipient, 'Vista support', subject, html, screenshot ? { name: `issue-screenshot-${randomUUID()}.${screenshot.mimetype.split('/')[1]}`, content: screenshot.buffer.toString('base64') } : undefined)
  } catch (error) {
    console.error('Could not send issue report:', error)
    return response.status(502).json({ message: 'Could not send the issue report. Check the email settings and try again.' })
  }
  response.status(202).json({ message: 'Thanks. Your issue report has been sent.' })
}
