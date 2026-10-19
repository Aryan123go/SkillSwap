import mongoose from 'mongoose'
import { HttpError } from '../utils/HttpError.js'
import { createReview as saveReview, getUserReviewSummary, listEligibleReviews } from '../services/review.service.js'

export async function getEligibleReviews(request, response) {
  const data = await listEligibleReviews(request.user)
  response.json({ success: true, data })
}

export async function createReview(request, response) {
  const review = await saveReview(request.user, request.validatedBody)
  response.status(201).json({ success: true, data: { review } })
}

export async function getReviewsForUser(request, response) {
  if (!mongoose.isValidObjectId(request.params.userId)) {
    throw new HttpError(404, 'This profile could not be found.', 'USER_NOT_FOUND')
  }
  const data = await getUserReviewSummary(request.params.userId)
  response.json({ success: true, data })
}
