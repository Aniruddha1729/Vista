import mongoose from 'mongoose'

const eventSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true },
  description: { type: String, required: true },
  category: { type: String, required: true },
  poster: String,
  startDate: { type: Date, required: true },
  endDate: Date,
  registrationDeadline: Date,
  venue: { type: String, required: true },
  mode: { type: String, enum: ['In person', 'Online', 'Hybrid'], default: 'In person' },
  capacity: { type: Number, min: 1, default: 100 },
  registeredCount: { type: Number, min: 0, default: 0 },
  inviteCount: { type: Number, min: 0, default: 0 },
  price: { type: String, default: 'Free' },
  priceAmountPaise: { type: Number, min: 0, default: 0, validate: Number.isSafeInteger },
  priceUnit: { type: String, enum: ['individual', 'team'], default: 'individual' },
  platformFeePayer: { type: String, enum: ['organiser', 'applicant'], default: 'organiser' },
  host: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  coHosts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  permissions: { type: Map, of: String, default: {} },
  status: { type: String, enum: ['draft', 'published', 'cancelled'], default: 'published' },
  eligibility: String,
  minTeamSize: { type: Number, min: 1, max: 6, default: 1 },
  maxTeamSize: { type: Number, min: 1, max: 6, default: 1 },
  tags: [String],
  overview: String,
  prizes: [String],
  shareToken: { type: String, unique: true, sparse: true },
  inviteTemplate: { type: String, enum: ['minimal', 'bold-gradient', 'dark-neon', 'formal'], default: 'minimal' },
  inviteMessage: { type: String, default: 'We would love to see you there.' },
  registrationTemplate: { type: String, enum: ['vista', 'editorial', 'electric', 'midnight', 'botanical', 'studio', 'summit', 'minimal'], default: 'vista' },
  financeLockUntil: Date,
  financeLockToken: String,
}, { timestamps: true })

eventSchema.index({ title: 'text', description: 'text', category: 'text', venue: 'text' })

export const Event = mongoose.model('Event', eventSchema)
