import mongoose from 'mongoose'
import Review from '../models/Review.js'
import Session from '../models/Session.js'
import User from '../models/User.js'
import { HttpError } from '../utils/HttpError.js'

function requireStudent(user) {
  if (user.role !== 'STUDENT') throw new HttpError(403, 'Only student accounts can submit reviews.', 'STUDENT_ACCOUNT_REQUIRED')
}

function idOf(value) {
  return (value?._id ?? value)?.toString()
}

function validReviewStages() {
  return [
    { $match: { rating: { $type: 'number', $gte: 1, $lte: 5 } } },
    { $match: { $expr: { $eq: [{ $mod: ['$rating', 1] }, 0] } } },
    {
      $lookup: {
        from: Session.collection.name,
        localField: 'session',
        foreignField: '_id',
        pipeline: [{ $project: { participants: 1, status: 1, title: 1, endAt: 1 } }],
        as: 'sessionRecord',
      },
    },
    { $unwind: '$sessionRecord' },
    { $match: { 'sessionRecord.participants': { $type: 'array' } } },
    {
      $match: {
        'sessionRecord.status': 'COMPLETED',
        $expr: {
          $and: [
            { $in: ['$reviewer', '$sessionRecord.participants'] },
            { $in: ['$reviewee', '$sessionRecord.participants'] },
            { $ne: ['$reviewer', '$reviewee'] },
          ],
        },
      },
    },
  ]
}

export async function listEligibleReviews(user) {
  requireStudent(user)
  const sessions = await Session.find({ participants: user._id, status: 'COMPLETED' })
    .sort({ endAt: -1, _id: -1 })
    .populate('participants', '_id name profileImage college')
    .lean()
  if (!sessions.length) return { sessions: [] }

  const sessionIds = sessions.map((session) => session._id)
  const existing = await Review.aggregate([
    ...validReviewStages(),
    { $match: { reviewer: user._id, session: { $in: sessionIds } } },
    { $project: { session: 1 } },
  ])
  const reviewed = new Set(existing.map((review) => review.session.toString()))
  return {
    sessions: sessions.filter((session) => !reviewed.has(session._id.toString())).map((session) => ({
      _id: session._id,
      title: session.title,
      startAt: session.startAt,
      endAt: session.endAt,
      partner: (Array.isArray(session.participants) ? session.participants : [])
        .find((participant) => idOf(participant) !== user._id.toString()) ?? null,
    })),
  }
}

export async function createReview(user, input) {
  requireStudent(user)
  if (!mongoose.isValidObjectId(input.sessionId)) throw new HttpError(400, 'Use a valid session ID.', 'INVALID_SESSION_ID')

  const session = await Session.findById(input.sessionId).select('_id status participants title').lean()
  if (!session) throw new HttpError(404, 'This session could not be found.', 'SESSION_NOT_FOUND')
  if (session.status !== 'COMPLETED') throw new HttpError(409, 'You can review a session only after it is completed.', 'SESSION_NOT_COMPLETED')
  const participantIds = Array.isArray(session.participants)
    ? session.participants.map((participant) => participant.toString())
    : []
  if (new Set(participantIds).size !== 2 || participantIds.length !== 2) {
    throw new HttpError(409, 'This session does not have two valid participants.', 'INVALID_REVIEWEE')
  }
  if (!participantIds.includes(user._id.toString())) throw new HttpError(403, 'Only participants of this session can leave a review.', 'REVIEW_ACCESS_DENIED')
  const revieweeId = participantIds.find((participantId) => participantId !== user._id.toString())
  if (!revieweeId) throw new HttpError(409, 'A review must be about the other session participant.', 'INVALID_REVIEWEE')

  const alreadyReviewed = await Review.exists({ session: session._id, reviewer: user._id })
  if (alreadyReviewed) throw new HttpError(409, 'You have already reviewed this session.', 'REVIEW_ALREADY_EXISTS')

  try {
    const review = await Review.create({
      session: session._id,
      reviewer: user._id,
      reviewee: revieweeId,
      rating: input.rating,
      comment: input.comment,
    })
    return Review.findById(review._id)
      .populate('reviewer', '_id name profileImage college')
      .populate('reviewee', '_id name profileImage college')
      .populate('session', '_id title endAt')
      .lean()
  } catch (error) {
    if (error?.code === 11000) throw new HttpError(409, 'You have already reviewed this session.', 'REVIEW_ALREADY_EXISTS')
    throw error
  }
}

export async function getUserReviewSummaries(userIds) {
  const validIds = [...new Set((userIds ?? []).filter((id) => mongoose.isValidObjectId(id)).map((id) => id.toString()))]
  if (!validIds.length) return {}

  const summaries = await Review.aggregate([
    ...validReviewStages(),
    { $match: { reviewee: { $in: validIds.map((id) => new mongoose.Types.ObjectId(id)) } } },
    { $group: { _id: '$reviewee', averageRating: { $avg: '$rating' }, reviewCount: { $sum: 1 } } },
  ])

  return Object.fromEntries(summaries.map((summary) => [summary._id.toString(), {
    averageRating: Math.round(summary.averageRating * 100) / 100,
    reviewCount: summary.reviewCount,
  }]))
}

export async function getUserReviewSummary(userId) {
  if (!mongoose.isValidObjectId(userId)) throw new HttpError(404, 'This profile could not be found.', 'USER_NOT_FOUND')
  const userExists = await User.exists({ _id: userId })
  if (!userExists) throw new HttpError(404, 'This profile could not be found.', 'USER_NOT_FOUND')

  const reviewee = new mongoose.Types.ObjectId(userId)
  const [summary] = await Review.aggregate([
    ...validReviewStages(),
    { $match: { reviewee } },
    { $group: { _id: '$reviewee', averageRating: { $avg: '$rating' }, reviewCount: { $sum: 1 } } },
  ])
  const reviews = await Review.aggregate([
    ...validReviewStages(),
    { $match: { reviewee } },
    { $sort: { createdAt: -1, _id: -1 } },
    { $limit: 50 },
    {
      $lookup: {
        from: User.collection.name,
        localField: 'reviewer',
        foreignField: '_id',
        pipeline: [{ $project: { name: 1, profileImage: 1, college: 1 } }],
        as: 'reviewerRecord',
      },
    },
    { $unwind: { path: '$reviewerRecord', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 1,
        rating: 1,
        comment: 1,
        createdAt: 1,
        reviewer: '$reviewerRecord',
        session: '$sessionRecord',
      },
    },
  ])
  return {
    reputation: {
      averageRating: summary ? Math.round(summary.averageRating * 100) / 100 : null,
      reviewCount: summary?.reviewCount ?? 0,
    },
    reviews,
  }
}
