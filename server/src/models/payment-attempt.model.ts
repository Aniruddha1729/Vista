import mongoose from 'mongoose'

const paymentAttemptSchema = new mongoose.Schema({
  orderId: { type: String, required: true, unique: true },
  paymentId: { type: String, unique: true, sparse: true },
  event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
  baseAmountPaise: { type: Number, min: 0, default: 0, validate: Number.isSafeInteger },
  platformFeePaise: { type: Number, min: 0, default: 0, validate: Number.isSafeInteger },
  platformFeePayer: { type: String, enum: ['organiser', 'applicant'], default: 'organiser' },
  status: { type: String, enum: ['created', 'paid', 'failed', 'refunded'], default: 'created' },
  formData: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true })

export const PaymentAttempt = mongoose.model('PaymentAttempt', paymentAttemptSchema)
