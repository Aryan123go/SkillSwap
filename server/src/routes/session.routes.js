import { Router } from 'express'
import {
  cancelSession,
  completeSession,
  confirmSession,
  createSession,
  declineSession,
  getSession,
  listSessions,
  rescheduleSession,
} from '../controllers/session.controller.js'
import { requireAuth } from '../middleware/auth.middleware.js'
import { validateBody } from '../middleware/validation.middleware.js'
import { createSessionSchema, rescheduleSessionSchema } from '../validators/session.validator.js'

const router = Router()

router.use(requireAuth)
router.route('/')
  .post(validateBody(createSessionSchema), createSession)
  .get(listSessions)
router.get('/:id', getSession)
router.patch('/:id/confirm', confirmSession)
router.patch('/:id/decline', declineSession)
router.patch('/:id/cancel', cancelSession)
router.patch('/:id/reschedule', validateBody(rescheduleSessionSchema), rescheduleSession)
router.patch('/:id/complete', completeSession)

export default router
