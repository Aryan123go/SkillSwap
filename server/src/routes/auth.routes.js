import { Router } from 'express'
import { currentUser, login, logout, register } from '../controllers/auth.controller.js'
import { requireAuth } from '../middleware/auth.middleware.js'
import { validateBody } from '../middleware/validation.middleware.js'
import { loginSchema, registerSchema } from '../validators/auth.validator.js'

const router = Router()

router.post('/register', validateBody(registerSchema), register)
router.post('/login', validateBody(loginSchema), login)
router.post('/logout', requireAuth, logout)
router.get('/me', requireAuth, currentUser)

export default router
