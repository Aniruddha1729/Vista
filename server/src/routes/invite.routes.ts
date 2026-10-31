import { Router } from 'express'
import { acceptInvite, getInvite } from '../controllers/invite.controller.js'
import { requireAuth } from '../middleware/require-auth.js'

const router = Router()

router.get('/:token', getInvite)
router.post('/:token/accept', requireAuth, acceptInvite)

export default router
