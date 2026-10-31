import mongoose from 'mongoose'

const profileSchema = new mongoose.Schema({
  phone: String,
  gender: String,
  dob: Date,
  college: String,
  degree: String,
  branch: String,
  graduationYear: Number,
  city: String,
  state: String,
  skills: [String],
  bio: String,
  linkedin: String,
  github: String,
  portfolio: String,
}, { _id: false })

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  username: { type: String, required: true, unique: true, lowercase: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  emailVerified: { type: Boolean, default: false },
  emailVerificationTokenHash: String,
  emailVerificationTokenExpiresAt: Date,
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['student', 'organizer', 'admin'], default: 'student' },
  plan: { type: String, enum: ['free', 'pro'], default: 'free' },
  proSubscriptionId: String,
  proExpiresAt: Date,
  avatarUrl: String,
  sidebarStyle: { type: String, enum: ['hover', 'dock'], default: 'hover' },
  profile: { type: profileSchema, default: () => ({}) },
  payoutBankEncrypted: { type: String, select: false },
}, { timestamps: true })

export const User = mongoose.model('User', userSchema)
