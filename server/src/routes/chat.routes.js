import { Router } from 'express'
import {
  getConversationById,
  getConversationForExchangeRequest,
  getConversations,
  getMessages,
  markRead,
  postMessage,
} from '../controllers/chat.controller.js'
import { requireAuth } from '../middleware/auth.middleware.js'
import { validateBody } from '../middleware/validation.middleware.js'
import { createMessageSchema } from '../validators/chat.validator.js'

const router = Router()
router.use(requireAuth)
router.get('/', getConversations)
router.get('/by-request/:requestId', getConversationForExchangeRequest)
router.patch('/:id/read', markRead)
router.get('/:id/messages', getMessages)
router.post('/:id/messages', validateBody(createMessageSchema), postMessage)
router.get('/:id', getConversationById)

export default router
