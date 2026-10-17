import mongoose from 'mongoose'
import { HttpError } from '../utils/HttpError.js'
import {
  cancelSession as cancel,
  completeSession as complete,
  confirmSession as confirm,
  createSession as create,
  declineSession as decline,
  getSession as findSession,
  listSessions as findSessions,
  rescheduleSession as reschedule,
} from '../services/session.service.js'
import { sessionListQuerySchema } from '../validators/session.validator.js'

export async function createSession(request, response) {
  const session = await create(request.user, request.validatedBody)
  response.status(201).json({ success: true, data: { session } })
}

export async function listSessions(request, response) {
  const parsed = sessionListQuerySchema.safeParse(request.query)
  if (!parsed.success) {
    throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Invalid session filters.', 'VALIDATION_ERROR')
  }
  const query = { ...parsed.data, page: Number(parsed.data.page), limit: Number(parsed.data.limit) }
  const result = await findSessions(request.user, query)
  response.json({ success: true, data: result })
}

export async function getSession(request, response) {
  const session = await findSession(request.user, request.params.id)
  response.json({ success: true, data: { session } })
}

async function update(request, response, action) {
  if (!mongoose.isValidObjectId(request.params.id)) {
    throw new HttpError(400, 'Use a valid session ID.', 'INVALID_SESSION_ID')
  }
  const session = await action(request.user, request.params.id, request.validatedBody)
  response.json({ success: true, data: { session } })
}

export function confirmSession(request, response) {
  return update(request, response, confirm)
}

export function declineSession(request, response) {
  return update(request, response, decline)
}

export function cancelSession(request, response) {
  return update(request, response, cancel)
}

export function rescheduleSession(request, response) {
  return update(request, response, reschedule)
}

export function completeSession(request, response) {
  return update(request, response, complete)
}
