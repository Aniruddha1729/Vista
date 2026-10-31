import { Router } from 'express'
import { addCoHost, applicants, cancelRegistration, createEvent, createTeamRegistration, deleteEvent, eventDiscovery, getEvent, getEventPreview, getManageEvent, getShareQr, listEvents, myHostedEvents, myRegistrations, myTeamInvitations, registerForEvent, regenerateShareToken, removeCoHost, resolveShareLink, saveEvent, savedEvents, scanRegistration, unsaveEvent, updateEvent } from '../controllers/event.controller.js'
import { acceptTeamById, acceptTeamRequest, getTeamInvitation } from '../controllers/team-registration.controller.js'
import { requireAuth } from '../middleware/require-auth.js'
import { requireEventHost } from '../middleware/require-event-host.js'
import { requireEventOwner } from '../middleware/require-event-owner.js'
import { rateLimit } from 'express-rate-limit'
import { createInvite, deleteInvite, invitePreview, listInvites, resendInvite } from '../controllers/invite.controller.js'
import { createEventOrder, createProSubscription, verifyEventPayment, verifyProSubscription } from '../controllers/payment.controller.js'
import { getEventFinance, requestEventWithdrawal } from '../controllers/organiser-finance.controller.js'

const router = Router()
const inviteLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 10, message: { message: 'Too many invitation requests. Try again later.' } })

router.post('/billing/pro/subscription', requireAuth, createProSubscription)
router.post('/billing/pro/verify', requireAuth, verifyProSubscription)

router.get('/', listEvents)
router.get('/discovery', eventDiscovery)
router.get('/mine/registrations', requireAuth, myRegistrations)
router.get('/mine/hosted', requireAuth, myHostedEvents)
router.get('/mine/team-invitations', requireAuth, myTeamInvitations)
router.get('/mine/saved', requireAuth, savedEvents)
router.get('/share/:token', resolveShareLink)
router.post('/', requireAuth, createEvent)
router.get('/:id/manage', requireAuth, requireEventHost, getManageEvent)
router.get('/:id/preview', requireAuth, requireEventHost, getEventPreview)
router.get('/:id/finance', requireAuth, getEventFinance)
router.post('/:id/withdraw', requireAuth, requestEventWithdrawal)
router.post('/:id/invite-preview', requireAuth, requireEventHost, invitePreview)
router.get('/:id/invites', requireAuth, requireEventHost, listInvites)
router.post('/:id/invites', requireAuth, requireEventHost, inviteLimiter, createInvite)
router.post('/:id/invites/:registrationId/resend', requireAuth, requireEventHost, inviteLimiter, resendInvite)
router.delete('/:id/invites/:registrationId', requireAuth, requireEventHost, deleteInvite)
router.get('/:id/share-qr', requireAuth, requireEventHost, getShareQr)
router.post('/:id/share-token', requireAuth, requireEventOwner, regenerateShareToken)
router.post('/:id/cohosts', requireAuth, requireEventOwner, addCoHost)
router.delete('/:id/cohosts/:userId', requireAuth, requireEventOwner, removeCoHost)
router.get('/:slug', getEvent)
router.patch('/:id', requireAuth, requireEventHost, updateEvent)
router.delete('/:id', requireAuth, requireEventOwner, deleteEvent)
router.post('/:id/register', requireAuth, registerForEvent)
router.post('/:id/payment-order', requireAuth, createEventOrder)
router.post('/payments/verify', requireAuth, verifyEventPayment)
router.post('/:id/register-team', requireAuth, inviteLimiter, createTeamRegistration)
router.get('/team-invitations/:token', requireAuth, getTeamInvitation)
router.post('/team-registrations/:token/accept', requireAuth, acceptTeamRequest)
router.post('/team-registrations/:teamId/join', requireAuth, acceptTeamById)
router.post('/:id/scan', requireAuth, requireEventHost, scanRegistration)
router.delete('/registrations/:registrationId', requireAuth, cancelRegistration)
router.put('/:id/save', requireAuth, saveEvent)
router.delete('/:id/save', requireAuth, unsaveEvent)
router.get('/:id/applicants', requireAuth, requireEventHost, applicants)

export default router
