import bcrypt from 'bcryptjs'
import User from '../models/User.js'
import { HttpError } from '../utils/HttpError.js'

const passwordRounds = 12

export function toSafeUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    profileImage: user.profileImage,
    bio: user.bio,
    college: user.college,
    role: user.role,
    skillsToTeach: user.skillsToTeach,
    skillsToLearn: user.skillsToLearn,
    availability: user.availability,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  }
}

export async function registerUser({ name, email, password }) {
  const normalizedEmail = email.trim().toLowerCase()
  if (await User.exists({ email: normalizedEmail })) {
    throw new HttpError(409, 'An account with this email already exists.', 'EMAIL_EXISTS')
  }

  const passwordHash = await bcrypt.hash(password, passwordRounds)
  const user = await User.create({
    name: name.trim(),
    email: normalizedEmail,
    passwordHash,
    role: 'STUDENT',
  })
  return user
}

export async function authenticateUser({ email, password }) {
  const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+passwordHash')
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new HttpError(401, 'Email or password is incorrect.', 'INVALID_CREDENTIALS')
  }
  return user
}
