import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { login, logout, me, refresh, reportIssue, resendVerification, signup, updateAvatar, updateProfile, updateSettings, verifyEmail } from '../controllers/auth.controller.js'
import { getPayoutBank, savePayoutBank } from '../controllers/organiser-finance.controller.js'
import { requireAuth } from '../middleware/require-auth.js'
import { avatarUpload, screenshotUpload } from '../middleware/uploads.js'
import { chatWithVee } from '../controllers/vee.controller.js'

const router = Router()
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, message: { message: 'Too many login attempts. Try again in 15 minutes.' } })
const issueLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 5, message: { message: 'Too many issue reports. Try again later.' } })
const verificationLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 5, message: { message: 'Too many verification requests. Try again later.' } })
const veeLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, message: { message: 'Vee is getting a lot of questions. Try again in a few minutes.' } })

router.post('/signup', signup)
router.post('/verify-email', verificationLimiter, verifyEmail)
router.post('/resend-verification', verificationLimiter, resendVerification)
router.post('/login', loginLimiter, login)
router.post('/logout', logout)
router.post('/refresh', refresh)
router.get('/me', requireAuth, me)
router.post('/vee', requireAuth, veeLimiter, chatWithVee)
router.put('/profile', requireAuth, updateProfile)
router.get('/profile/payout-bank', requireAuth, getPayoutBank)
router.put('/profile/payout-bank', requireAuth, savePayoutBank)
router.post('/avatar', requireAuth, avatarUpload.single('avatar'), updateAvatar)
router.patch('/settings', requireAuth, updateSettings)
router.post('/report-issue', requireAuth, issueLimiter, screenshotUpload.single('screenshot'), reportIssue)

export default router
