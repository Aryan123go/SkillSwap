import mongoose from 'mongoose'
import { HttpError } from '../utils/HttpError.js'
import {
  changeExchangeRequestStatus,
  createExchangeRequest as createRequest,
  getExchangeRequest as findRequest,
  listExchangeRequests,
} from '../services/exchange-request.service.js'
import { requestListQuerySchema } from '../validators/exchange-request.validator.js'

export async function createExchangeRequest(request, response) {
  const exchangeRequest = await createRequest(request.user, request.validatedBody)
  response.status(201).json({ success: true, data: { request: exchangeRequest } })
}

async function listRequests(request, response, direction) {
  const parsed = requestListQuerySchema.safeParse(request.query)
  if (!parsed.success) {
    throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Invalid pagination parameters.', 'VALIDATION_ERROR')
  }
  const query = { page: Number(parsed.data.page), limit: Number(parsed.data.limit) }
  const result = await listExchangeRequests(request.user, direction, query)
  response.json({ success: true, data: result })
}

export function getSentRequests(request, response) {
  return listRequests(request, response, 'sent')
}

export function getReceivedRequests(request, response) {
  return listRequests(request, response, 'received')
}

export async function getRequest(request, response) {
  if (!mongoose.isValidObjectId(request.params.id)) {
    throw new HttpError(400, 'Use a valid exchange request ID.', 'INVALID_REQUEST_ID')
  }
  const exchangeRequest = await findRequest(request.user, request.params.id)
  response.json({ success: true, data: { request: exchangeRequest } })
}

async function updateStatus(request, response, action) {
  const exchangeRequest = await changeExchangeRequestStatus(request.user, request.params.id, action)
  response.json({ success: true, data: { request: exchangeRequest } })
}

export function acceptRequest(request, response) {
  return updateStatus(request, response, 'ACCEPTED')
}

export function rejectRequest(request, response) {
  return updateStatus(request, response, 'REJECTED')
}

export function cancelRequest(request, response) {
  return updateStatus(request, response, 'CANCELLED')
}
