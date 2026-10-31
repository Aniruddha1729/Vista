import bcrypt from 'bcrypt'
import dotenv from 'dotenv'
import mongoose from 'mongoose'
import { fileURLToPath } from 'node:url'
import { randomBytes } from 'node:crypto'
import { Event } from '../src/models/event.model.js'
import { Registration } from '../src/models/registration.model.js'
import { User } from '../src/models/user.model.js'

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) })

const demoEmail = 'demo@vista.test'
const demoUsername = 'vistademo'
const demoPassword = 'VistaDemo2026!'
const organizerEmail = 'organizer@vista.test'
const organizerUsername = 'vistaorganizer'
const organizerPassword = 'VistaHost2026!'

async function seed() {
  const mongoUri = process.env.MONGODB_URI
  if (!mongoUri) throw new Error('MONGODB_URI is missing. Add your MongoDB connection string to server/.env.')

  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 })
  const passwordHash = await bcrypt.hash(demoPassword, 12)
  const user = await User.findOneAndUpdate(
    { email: demoEmail },
    { $set: { name: 'Vista Demo', username: demoUsername, email: demoEmail, passwordHash, role: 'organizer', emailVerified: true } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )
  const organizerPasswordHash = await bcrypt.hash(organizerPassword, 12)
  const organizer = await User.findOneAndUpdate(
    { email: organizerEmail },
    { $set: { name: 'Vista Campus Organizer', username: organizerUsername, email: organizerEmail, passwordHash: organizerPasswordHash, role: 'organizer', emailVerified: true } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )

  const day = 24 * 60 * 60 * 1000
  const eventSeeds = [
    { title: 'Campus Build Weekend', slug: 'campus-build-weekend', description: 'A friendly, hands-on hackathon for turning campus ideas into useful prototypes.', category: 'Hackathon', startDate: new Date(Date.now() + 10 * day), venue: 'Innovation Hall, North Campus', mode: 'In person' as const, capacity: 120, price: 'Free', poster: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1200&q=85', tags: ['Build', 'Teams', 'Prizes'] },
    { title: 'Design for Everyone', slug: 'design-for-everyone', description: 'Explore practical ways to make digital products easier and more welcoming to use.', category: 'Workshop', startDate: new Date(Date.now() + 18 * day), venue: 'Design Studio 204', mode: 'Hybrid' as const, capacity: 60, price: 'Free', poster: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=85', tags: ['Design', 'Accessibility'] },
    { title: 'Future of Learning Forum', slug: 'future-of-learning-forum', description: 'Students and educators share fresh ideas for the future of learning and research.', category: 'Conference', startDate: new Date(Date.now() + 26 * day), venue: 'University Auditorium', mode: 'In person' as const, capacity: 200, price: 'Free', poster: 'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?auto=format&fit=crop&w=1200&q=85', tags: ['Talks', 'Community'] },
    { title: 'Student Venture Showcase', slug: 'student-venture-showcase', description: 'Meet student founders, hear short pitches, and connect with the campus startup community.', category: 'Competition', startDate: new Date(Date.now() + 35 * day), venue: 'Launchpad Commons', mode: 'In person' as const, capacity: 90, price: 'Free', poster: 'https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=1200&q=85', tags: ['Startups', 'Pitch'] },
  ]

  const events = []
  for (const eventSeed of eventSeeds) {
    const event = await Event.findOneAndUpdate(
      { slug: eventSeed.slug },
      { $set: { ...eventSeed, host: user._id, status: 'published', registeredCount: 0 }, $setOnInsert: { shareToken: randomBytes(24).toString('base64url') } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    )
    events.push(event)
  }

  await Registration.deleteOne({ user: user._id, event: { $in: events.map((event) => event._id) } })

  const organizerEventSeeds = [
    { title: 'Vista Open Air Film Night', slug: 'vista-open-air-film-night', description: 'A relaxed outdoor film night hosted by the Vista campus organizing team.', category: 'Conference', startDate: new Date(Date.now() + 14 * day), venue: 'Central Campus Lawn', mode: 'In person' as const, capacity: 180, price: 'Free', poster: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1200&q=85', tags: ['Film', 'Community'] },
    { title: 'Vista Creative Coding Lab', slug: 'vista-creative-coding-lab', description: 'A hands-on creative coding workshop for students who want to make interactive art.', category: 'Workshop', startDate: new Date(Date.now() + 22 * day), venue: 'Media Lab 1', mode: 'Hybrid' as const, capacity: 48, price: 'Free', poster: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=85', tags: ['Creative coding', 'Workshop'] },
  ]

  const organizerEvents = []
  for (const eventSeed of organizerEventSeeds) {
    const event = await Event.findOneAndUpdate(
      { slug: eventSeed.slug },
      { $set: { ...eventSeed, host: organizer._id, status: 'published', registeredCount: 0 }, $setOnInsert: { shareToken: randomBytes(24).toString('base64url') } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    )
    organizerEvents.push(event)
  }

  console.log(`Seeded ${events.length + organizerEvents.length} events, the verified demo account, and a separate organizer account.`)
  console.log(`Email: ${demoEmail}`)
  console.log(`Username: ${demoUsername}`)
  console.log(`Password: ${demoPassword}`)
  console.log(`Organizer email: ${organizerEmail}`)
  console.log(`Organizer username: ${organizerUsername}`)
  console.log(`Organizer password: ${organizerPassword}`)
}

seed().catch((error: unknown) => {
  console.error('Could not seed Vista sample data:', error instanceof Error ? error.message : error)
  process.exitCode = 1
}).finally(async () => {
  await mongoose.disconnect()
})
