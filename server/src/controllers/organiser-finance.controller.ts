import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import type { Request, Response } from 'express'
import { z } from 'zod'
import { Event } from '../models/event.model.js'
import { LedgerEntry } from '../models/ledger-entry.model.js'
import { User } from '../models/user.model.js'
import { acquireEventLedgerLock, calculateLedgerBalance, releaseEventLedgerLock, requestLedgerWithdrawal } from '../services/event-ledger.js'
import type { LedgerRow, WithdrawalLedgerStore } from '../services/event-ledger.js'

function bankKey() {
  const value = process.env.BANK_DETAILS_ENCRYPTION_KEY || ''
  if (!/^[a-f\d]{64}$/i.test(value)) throw new Error('BANK_DETAILS_ENCRYPTION_KEY must be a 32-byte hex key.')
  return Buffer.from(value, 'hex')
}
function encrypt(value: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', bankKey(), iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  return `${iv.toString('hex')}.${cipher.getAuthTag().toString('hex')}.${encrypted.toString('hex')}`
}
function decrypt(value: string) {
  const [iv, tag, data] = value.split('.')
  const decipher = createDecipheriv('aes-256-gcm', bankKey(), Buffer.from(iv, 'hex'))
  decipher.setAuthTag(Buffer.from(tag, 'hex'))
  return Buffer.concat([decipher.update(Buffer.from(data, 'hex')), decipher.final()]).toString('utf8')
}

const bankSchema = z.object({ accountHolder: z.string().trim().min(2).max(100), accountNumber: z.string().trim().regex(/^\d{8,20}$/).optional().or(z.literal('')), ifsc: z.string().trim().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/i), bankName: z.string().trim().min(2).max(100) })
export async function getPayoutBank(request: Request, response: Response) {
  const user = await User.findById(request.auth.sub).select('+payoutBankEncrypted')
  if (!user) return response.status(404).json({ message: 'Account not found.' })
  if (!user.payoutBankEncrypted) return response.json({ bank: null })
  try {
    const bank = JSON.parse(decrypt(user.payoutBankEncrypted)) as z.infer<typeof bankSchema>
    return response.json({ bank: { accountHolder: bank.accountHolder, bankName: bank.bankName, ifsc: bank.ifsc, accountLast4: bank.accountNumber.slice(-4) } })
  } catch { return response.status(503).json({ message: 'Bank details could not be read. Check the encryption key configuration.' }) }
}
export async function savePayoutBank(request: Request, response: Response) {
  const parsed = bankSchema.safeParse(request.body)
  if (!parsed.success) return response.status(400).json({ message: 'Enter a valid account holder, 8–20 digit account number, bank, and IFSC code.' })
  let accountNumber = parsed.data.accountNumber
  if (!accountNumber) {
    const current = await User.findById(request.auth.sub).select('+payoutBankEncrypted')
    if (!current?.payoutBankEncrypted) return response.status(400).json({ message: 'Enter the bank account number to save payout details.' })
    try { accountNumber = (JSON.parse(decrypt(current.payoutBankEncrypted)) as z.infer<typeof bankSchema>).accountNumber }
    catch { return response.status(503).json({ message: 'Existing bank details could not be read. Enter the account number again after checking the encryption key.' }) }
  }
  let encrypted: string
  try { encrypted = encrypt(JSON.stringify({ ...parsed.data, accountNumber, ifsc: parsed.data.ifsc.toUpperCase() })) }
  catch (error) { return response.status(503).json({ message: error instanceof Error ? error.message : 'Bank detail encryption is not configured.' }) }
  await User.updateOne({ _id: request.auth.sub }, { $set: { payoutBankEncrypted: encrypted } })
  response.json({ message: 'Bank details saved securely.', bank: { accountHolder: parsed.data.accountHolder, bankName: parsed.data.bankName, ifsc: parsed.data.ifsc.toUpperCase(), accountLast4: accountNumber.slice(-4) } })
}

export async function getEventFinance(request: Request, response: Response) {
  const event = await Event.findOne({ _id: request.params.id, host: request.auth.sub })
  if (!event) return response.status(404).json({ message: 'Event not found or you do not own it.' })
  const [rows, user] = await Promise.all([
    LedgerEntry.find({ eventId: event.id, organiserId: request.auth.sub }).lean(),
    User.findById(request.auth.sub).select('+payoutBankEncrypted'),
  ])
  const balance = calculateLedgerBalance(rows)
  const payoutEligibleAt = new Date((event.endDate || event.startDate).getTime() + 48 * 60 * 60 * 1000)
  response.json({ applicants: rows.filter((row) => row.type === 'payment' && row.status === 'captured').length, ...balance, eligible: new Date() >= payoutEligibleAt, bankOnFile: Boolean(user?.payoutBankEncrypted), withdrawals: rows.filter((row) => row.type === 'payout').sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).map((row) => ({ id: String(row._id), amountPaise: row.amountPaise, status: row.status, createdAt: row.createdAt, idempotencyKey: row.idempotencyKey })) })
}

export async function requestEventWithdrawal(request: Request, response: Response) {
  const parsed = z.object({ amountPaise: z.number().int().positive() }).safeParse(request.body)
  if (!parsed.success) return response.status(400).json({ message: 'Enter a valid withdrawal amount.' })
  const event = await Event.findOne({ _id: request.params.id, host: request.auth.sub })
  if (!event) return response.status(404).json({ message: 'Event not found or you do not own it.' })
  if (new Date() < new Date((event.endDate || event.startDate).getTime() + 48 * 60 * 60 * 1000)) return response.status(400).json({ message: 'Withdrawals are available 48 hours after the event ends.' })
  const user = await User.findById(request.auth.sub).select('+payoutBankEncrypted')
  if (!user?.payoutBankEncrypted) return response.status(400).json({ message: 'Add bank details in your Vista profile first.' })
  const idempotencyKey = request.get('Idempotency-Key')
  if (!idempotencyKey || !/^[\w.-]{8,128}$/.test(idempotencyKey)) return response.status(400).json({ message: 'Send a valid Idempotency-Key header for this withdrawal request.' })
  const scopedIdempotencyKey = `${request.auth.sub}:${event.id}:${idempotencyKey}`
  let lockToken = ''
  type RequestEntry = LedgerRow & { idempotencyKey?: string; _id: { toString(): string } }
  const store: WithdrawalLedgerStore<RequestEntry> = {
    async findByKey(key: string) { return await LedgerEntry.findOne({ idempotencyKey: key, eventId: event.id, organiserId: request.auth.sub }).lean() as RequestEntry | null },
    async acquireLock() {
      for (let attempt = 0; attempt < 10; attempt += 1) {
        const token = await acquireEventLedgerLock(event.id, scopedIdempotencyKey)
        if (token) { lockToken = token; return true }
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
      return false
    },
    async releaseLock() { if (lockToken) await releaseEventLedgerLock(event.id, lockToken) },
    async getRows() { return await LedgerEntry.find({ eventId: event.id, organiserId: request.auth.sub }).lean() as RequestEntry[] },
    async addPayout(input: { amountPaise: number; idempotencyKey: string }) {
      return await LedgerEntry.create({ eventId: event.id, organiserId: request.auth.sub, type: 'payout', amountPaise: input.amountPaise, idempotencyKey: input.idempotencyKey, status: 'requested' }) as unknown as RequestEntry
    },
  }
  try {
    const result = await requestLedgerWithdrawal(store, parsed.data.amountPaise, scopedIdempotencyKey)
    response.status(result.duplicate ? 200 : 202).json({ message: result.duplicate ? 'This withdrawal request was already recorded.' : 'Withdrawal request recorded and awaiting payout processing.', withdrawal: { id: result.entry._id.toString(), amountPaise: result.entry.amountPaise, status: result.entry.status }, idempotentReplay: result.duplicate })
  } catch (error) {
    const reason = error instanceof Error ? error.message : ''
    if (reason === 'refund_pending') return response.status(409).json({ message: 'Withdrawals are paused while a refund is being processed.' })
    if (reason === 'insufficient_available') return response.status(409).json({ message: 'The request is greater than the available ledger balance.' })
    if (reason === 'withdrawal_busy') return response.status(409).json({ message: 'Another withdrawal is being checked. Retry shortly with the same Idempotency-Key.' })
    throw error
  }
}
