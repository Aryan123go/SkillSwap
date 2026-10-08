import { HttpError } from '../utils/HttpError.js'

export function validateBody(schema) {
  return (request, _response, next) => {
    const result = schema.safeParse(request.body)
    if (!result.success) {
      next(new HttpError(400, result.error.issues[0]?.message ?? 'Invalid request data.', 'VALIDATION_ERROR'))
      return
    }
    request.validatedBody = result.data
    next()
  }
}
