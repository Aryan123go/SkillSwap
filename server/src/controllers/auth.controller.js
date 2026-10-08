import { authenticateUser, registerUser, toSafeUser } from '../services/auth.service.js'
import { createToken, getTokenLifetimeSeconds } from '../utils/jwt.js'
import { HttpError } from '../utils/HttpError.js'

const cookieName = 'skillswap_token'
const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  path: '/',
  maxAge: getTokenLifetimeSeconds() * 1000,
})

async function populateUserSkills(user) {
  return user.populate([
    { path: 'skillsToTeach.skill', select: 'name category aliases' },
    { path: 'skillsToLearn.skill', select: 'name category aliases' },
  ])
}

function establishSession(response, user) {
  response.cookie(cookieName, createToken(user._id.toString()), cookieOptions())
}

export async function register(request, response) {
  const user = await registerUser(request.validatedBody)
  await populateUserSkills(user)
  establishSession(response, user)
  response.status(201).json({ success: true, data: { user: toSafeUser(user) } })
}

export async function login(request, response) {
  const user = await authenticateUser(request.validatedBody)
  await populateUserSkills(user)
  establishSession(response, user)
  response.json({ success: true, data: { user: toSafeUser(user) } })
}

export function logout(_request, response) {
  response.clearCookie(cookieName, { ...cookieOptions(), maxAge: undefined })
  response.json({ success: true, data: { message: 'You have been signed out.' } })
}

export function currentUser(request, response) {
  if (!request.user) throw new HttpError(401, 'Please sign in to continue.', 'AUTHENTICATION_REQUIRED')
  response.json({ success: true, data: { user: toSafeUser(request.user) } })
}
