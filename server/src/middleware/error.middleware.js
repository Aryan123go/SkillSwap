import mongoose from 'mongoose'
import { HttpError } from '../utils/HttpError.js'

export function notFoundHandler(_request, _response, next) {
  next(new HttpError(404, 'The requested resource was not found.', 'NOT_FOUND'))
}

export function errorHandler(error, _request, response, _next) {
  if (response.headersSent) return

  if (error.type === 'entity.parse.failed') {
    response.status(400).json({ success: false, message: 'The request body must be valid JSON.', code: 'INVALID_JSON' })
    return
  }

  if (error instanceof mongoose.Error.ValidationError || error instanceof mongoose.Error.CastError) {
    response.status(400).json({ success: false, message: 'The submitted data is invalid.', code: 'VALIDATION_ERROR' })
    return
  }

  if (error.code === 11000) {
    response.status(409).json({ success: false, message: 'An account with this email already exists.', code: 'EMAIL_EXISTS' })
    return
  }

  const status = error instanceof HttpError ? error.status : 500
  const message = error instanceof HttpError ? error.message : 'An unexpected server error occurred.'
  const code = error instanceof HttpError ? error.code : 'INTERNAL_SERVER_ERROR'
  if (status >= 500) console.error('Request failed with an internal error:', error.name)

  response.status(status).json({ success: false, message, code })
}
