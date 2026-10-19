import { Router } from 'express'
import { createReview, getEligibleReviews, getReviewsForUser } from '../controllers/review.controller.js'
import { requireAuth } from '../middleware/auth.middleware.js'
import { validateBody } from '../middleware/validation.middleware.js'
import { createReviewSchema } from '../validators/review.validator.js'

const router = Router()
router.use(requireAuth)
router.get('/eligible', getEligibleReviews)
router.get('/user/:userId', getReviewsForUser)
router.post('/', validateBody(createReviewSchema), createReview)
export default router
