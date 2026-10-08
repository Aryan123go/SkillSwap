import User from '../models/User.js'
import { verifyToken } from '../utils/jwt.js'
import { HttpError } from '../utils/HttpError.js'

export async function requireAuth(request, _response, next) {
  try {
    const token = request.cookies?.skillswap_token
    if (!token) throw new HttpError(401, 'Please sign in to continue.', 'AUTHENTICATION_REQUIRED')

    const payload = verifyToken(token)
    const user = await User.findById(payload.sub)
      .populate('skillsToTeach.skill', 'name category aliases')
      .populate('skillsToLearn.skill', 'name category aliases')
    if (!user) throw new HttpError(401, 'Your session is no longer valid.', 'INVALID_SESSION')

    request.user = user
    next()
  } catch (error) {
    if (error instanceof HttpError) {
      next(error)
      return
    }
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      next(new HttpError(401, 'Your session is invalid or expired. Please sign in again.', 'INVALID_TOKEN'))
      return
    }
    next(error)
  }
}
