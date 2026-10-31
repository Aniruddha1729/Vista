import mongoose from 'mongoose'

const teamMemberSchema = new mongoose.Schema({
  email: { type: String, required: true, lowercase: true, trim: true },
  tokenHash: { type: String, required: true },
  status: { type: String, enum: ['pending', 'accepted'], default: 'pending' },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  acceptedAt: Date,
  registration: { type: mongoose.Schema.Types.ObjectId, ref: 'Registration' },
}, { _id: false })

const teamRegistrationSchema = new mongoose.Schema({
  event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  leader: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  teamName: { type: String, required: true, trim: true, maxlength: 100 },
  teamSize: { type: Number, required: true, min: 2, max: 6 },
  status: { type: String, enum: ['pending', 'processing', 'confirmed', 'capacity_full', 'expired'], default: 'pending' },
  expiresAt: { type: Date, required: true },
  formData: { type: mongoose.Schema.Types.Mixed, default: {} },
  members: { type: [teamMemberSchema], required: true },
}, { timestamps: true })

export type TeamRegistrationDocument = mongoose.HydratedDocument<mongoose.InferSchemaType<typeof teamRegistrationSchema>>
export type TeamRegistrationMember = TeamRegistrationDocument['members'][number]

teamRegistrationSchema.index({ event: 1, leader: 1, status: 1 })
teamRegistrationSchema.index({ 'members.tokenHash': 1 }, { sparse: true })

export const TeamRegistration = mongoose.model('TeamRegistration', teamRegistrationSchema)
