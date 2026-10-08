import { z } from 'zod'

const email = z.string().trim().email().max(254)
const password = z.string().min(8).max(72).refine(
  (value) => Buffer.byteLength(value, 'utf8') <= 72,
  'Password must not exceed 72 UTF-8 bytes.',
)

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email,
  password,
}).strict()

export const loginSchema = z.object({ email, password }).strict()
