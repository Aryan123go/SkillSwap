import { Router } from 'express'
import {
  acceptRequest,
  cancelRequest,
  createExchangeRequest,
  getReceivedRequests,
  getRequest,
  getSentRequests,
  rejectRequest,
} from '../controllers/exchange-request.controller.js'
import { requireAuth } from '../middleware/auth.middleware.js'
import { validateBody } from '../middleware/validation.middleware.js'
import { createExchangeRequestSchema } from '../validators/exchange-request.validator.js'

const router = Router()

router.use(requireAuth)
router.post('/', validateBody(createExchangeRequestSchema), createExchangeRequest)
router.get('/sent', getSentRequests)
router.get('/received', getReceivedRequests)
router.get('/:id', getRequest)
router.patch('/:id/accept', acceptRequest)
router.patch('/:id/reject', rejectRequest)
router.patch('/:id/cancel', cancelRequest)

export default router
