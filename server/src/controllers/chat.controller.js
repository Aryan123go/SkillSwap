import mongoose from 'mongoose'
import { createMessage, getConversation, getConversationForRequest, listConversations, listMessages } from '../services/chat.service.js'
import { HttpError } from '../utils/HttpError.js'

export async function getConversations(request, response) {
  const conversations = await listConversations(request.user)
  response.json({ success: true, data: { conversations } })
}

export async function getConversationById(request, response) {
  const conversation = await getConversation(request.user, request.params.id)
  response.json({ success: true, data: { conversation } })
}

export async function getConversationForExchangeRequest(request, response) {
  const conversation = await getConversationForRequest(request.user, request.params.requestId)
  response.json({ success: true, data: { conversation } })
}

export async function getMessages(request, response) {
  const page = request.query.page === undefined ? 1 : Number(request.query.page)
  const limit = request.query.limit === undefined ? 50 : Number(request.query.limit)
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new HttpError(400, 'Page must be positive and limit must be between 1 and 100.', 'INVALID_PAGINATION')
  }
  const result = await listMessages(request.user, request.params.id, { page, limit })
  response.json({ success: true, data: result })
}

export async function postMessage(request, response) {
  if (!mongoose.isValidObjectId(request.params.id)) {
    throw new HttpError(400, 'Use a valid conversation ID.', 'INVALID_CONVERSATION_ID')
  }
  const message = await createMessage(request.user, request.params.id, request.validatedBody)
  response.status(201).json({ success: true, data: { message } })
}
