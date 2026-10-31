import dotenv from 'dotenv'
import { fileURLToPath } from 'node:url'
import mongoose from 'mongoose'
import type { Server } from 'node:http'
import { Event } from './models/event.model.js'
import { SavedEvent } from './models/saved-event.model.js'
import { User } from './models/user.model.js'
import { TeamRegistration } from './models/team-registration.model.js'
import { PaymentAttempt } from './models/payment-attempt.model.js'
import { LedgerEntry } from './models/ledger-entry.model.js'
import { EventWithdrawal } from './models/event-withdrawal.model.js'
import { prepareRegistrationIndexes } from './utils/migrations.js'
import { validateEnvironment } from './config/environment.js'

// Load the server's own .env file even when the command is run from another folder.
dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) })

let httpServer: Server | undefined
let shuttingDown = false

function shutdown(exitCode = 0) {
  if (shuttingDown) return
  shuttingDown = true
  const finish = () => { void mongoose.disconnect().finally(() => process.exit(exitCode)) }
  if (!httpServer) return finish()
  httpServer.close(finish)
  const timeout = setTimeout(() => process.exit(exitCode), 10_000)
  timeout.unref()
}

process.on('SIGINT', () => shutdown())
process.on('SIGTERM', () => shutdown())
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection; shutting down the Vista API.', reason)
  shutdown(1)
})
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception; shutting down the Vista API.', error)
  shutdown(1)
})

async function startServer() {
  validateEnvironment()
  const mongoUri = process.env.MONGODB_URI
  const port = Number(process.env.PORT || 4000)

  await mongoose.connect(mongoUri as string, { autoIndex: false })
  await Event.collection.updateMany(
    { priceAmountPaise: { $exists: false }, priceAmount: { $type: 'number' } },
    [{ $set: { priceAmountPaise: { $multiply: ['$priceAmount', 100] } } }],
  )
  await prepareRegistrationIndexes()
  await Promise.all([Event.createIndexes(), SavedEvent.createIndexes(), User.createIndexes(), TeamRegistration.createIndexes(), PaymentAttempt.createIndexes(), LedgerEntry.createIndexes()])
  const oldWithdrawals = await EventWithdrawal.find().lean()
  for (const withdrawal of oldWithdrawals) {
    if (!Number.isSafeInteger(withdrawal.amount) || withdrawal.amount <= 0) continue
    const status = withdrawal.status === 'paid' ? 'processed' : withdrawal.status === 'rejected' ? 'failed' : 'requested'
    await LedgerEntry.updateOne({ razorpayId: `legacy-withdrawal-${withdrawal._id}` }, { $setOnInsert: { eventId: withdrawal.event, organiserId: withdrawal.organiser, type: 'payout', amountPaise: withdrawal.amount, razorpayId: `legacy-withdrawal-${withdrawal._id}`, status, createdAt: withdrawal.createdAt } }, { upsert: true })
  }
  const { default: app } = await import('./app.js')
  httpServer = app.listen(port, () => console.log(`Vista API listening on port ${port}`))
}

startServer().catch((error) => {
  console.error('Could not start the Vista API:', error.message)
  process.exit(1)
})
