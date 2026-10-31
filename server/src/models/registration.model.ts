import mongoose from 'mongoose'

const registrationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  teamRegistration: { type: mongoose.Schema.Types.ObjectId, ref: 'TeamRegistration' },
  teamName: { type: String, trim: true, maxlength: 100 },
  teamLeader: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  type: { type: String, enum: ['registered', 'invited'], default: 'registered' },
  status: { type: String, enum: ['pending', 'confirmed', 'cancelled', 'waitlisted'], default: 'confirmed' },
  checkedIn: { type: Boolean, default: false },
  checkedInAt: Date,
  checkedInBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  ticketId: { type: String, unique: true, sparse: true, select: false },
  inviteEmail: { type: String, lowercase: true, trim: true },
  inviteTokenHash: { type: String, select: false },
  inviteExpiresAt: Date,
  acceptedAt: Date,
  formData: { type: mongoose.Schema.Types.Mixed, default: {} },
  paymentId: String,
}, { timestamps: true })

registrationSchema.index({ user: 1, event: 1 }, { unique: true, partialFilterExpression: { user: { $type: 'objectId' } } })
registrationSchema.index({ event: 1, inviteEmail: 1 }, { unique: true, partialFilterExpression: { inviteEmail: { $type: 'string' } } })
registrationSchema.index({ inviteTokenHash: 1 }, { sparse: true })

export const Registration = mongoose.model('Registration', registrationSchema)
