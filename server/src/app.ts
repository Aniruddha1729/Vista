import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import type { ErrorRequestHandler } from 'express'
import mongoose from 'mongoose'
import { rateLimit } from 'express-rate-limit'
import authRoutes from './routes/auth.routes.js'
import eventRoutes from './routes/event.routes.js'
import registrationRoutes from './routes/registration.routes.js'
import inviteRoutes from './routes/invite.routes.js'
import { razorpayWebhook } from './controllers/razorpay-webhook.controller.js'

const app = express()
const allowedOrigins = new Set((process.env.CLIENT_URL || '').split(',').map((origin) => origin.trim()).filter(Boolean))
const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false, skip: (request) => request.path === '/webhooks/razorpay' })

// Middleware prepares each request before it reaches a route.
app.set('trust proxy', process.env.NODE_ENV === 'production' ? 1 : false)
app.use(helmet())
app.use(cors({ origin: (origin, callback) => callback(null, !origin || allowedOrigins.has(origin)), credentials: true }))
// Razorpay signs the exact bytes it sends, so its endpoint must receive the raw body.
app.post('/api/webhooks/razorpay', express.raw({ type: 'application/json' }), razorpayWebhook)
app.use('/api', apiLimiter)
app.use(express.json())
app.use(cookieParser())
// A tiny route to confirm the API is running.
app.get('/api/health', (_request, response) => {
  const databaseConnected = mongoose.connection.readyState === 1
  response.status(databaseConnected ? 200 : 503).json({ status: databaseConnected ? 'ok' : 'unavailable', database: { connected: databaseConnected, readyState: mongoose.connection.readyState } })
})

app.use('/api/auth', authRoutes)
app.use('/api/events', eventRoutes)
app.use('/api/registrations', registrationRoutes)
app.use('/api/invites', inviteRoutes)

const handleError: ErrorRequestHandler = (error, _request, response, next) => {
  console.error(error)
  if (response.headersSent) return next(error)
  const production = process.env.NODE_ENV === 'production'
  response.status(500).json({ message: production ? 'Something went wrong. Please try again.' : error instanceof Error ? error.message : 'Something went wrong. Please try again.' })
}

app.use(handleError)

export default app
