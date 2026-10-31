import mongoose from 'mongoose'

const eventWithdrawalSchema = new mongoose.Schema({
  event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  organiser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true },
  status: { type: String, enum: ['requested', 'paid', 'rejected'], default: 'requested' },
  reference: String,
}, { timestamps: true })
eventWithdrawalSchema.index({ event: 1, organiser: 1, status: 1 })
export const EventWithdrawal = mongoose.model('EventWithdrawal', eventWithdrawalSchema)
