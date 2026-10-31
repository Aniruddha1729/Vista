import { Router } from 'express'
import { getRegistrationQr } from '../controllers/registration.controller.js'
import { requireAuth } from '../middleware/require-auth.js'

const router = Router()

router.get('/:id/qr', requireAuth, getRegistrationQr)

export default router
