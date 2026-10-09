import { Router } from 'express'
import { discoverStudents, getMyProfile, getPublicProfile, getRecommendations, updateMyProfile } from '../controllers/user.controller.js'
import { requireAuth } from '../middleware/auth.middleware.js'
import { validateBody } from '../middleware/validation.middleware.js'
import { updateUserSchema } from '../validators/user.validator.js'

const router = Router()

router.get('/me', requireAuth, getMyProfile)
router.put('/me', requireAuth, validateBody(updateUserSchema), updateMyProfile)
router.get('/discover', requireAuth, discoverStudents)
router.get('/recommendations', requireAuth, getRecommendations)
router.get('/:id', getPublicProfile)

export default router
