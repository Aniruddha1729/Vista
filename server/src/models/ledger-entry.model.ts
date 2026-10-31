import mongoose from 'mongoose'

const ledgerEntrySchema = new mongoose.Schema({
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
  organiserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, enum: ['payment', 'refund', 'gateway_fee', 'platform_fee', 'payout', 'payout_reversal'], required: true },
  amountPaise: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
  razorpayId: { type: String, trim: true },
  idempotencyKey: { type: String, trim: true },
  status: { type: String, enum: ['created', 'captured', 'requested', 'processing', 'processed', 'failed'], required: true },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: { createdAt: true, updatedAt: false } })

ledgerEntrySchema.index({ razorpayId: 1, type: 1 }, { unique: true, partialFilterExpression: { razorpayId: { $type: 'string' } } })
ledgerEntrySchema.index({ idempotencyKey: 1 }, { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } })
ledgerEntrySchema.index({ eventId: 1, organiserId: 1, type: 1, status: 1 })

export const LedgerEntry = mongoose.model('LedgerEntry', ledgerEntrySchema)
