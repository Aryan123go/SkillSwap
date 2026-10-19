import test from 'node:test'
import assert from 'node:assert/strict'
import Review from '../src/models/Review.js'
import Session from '../src/models/Session.js'
import User from '../src/models/User.js'
import {
  createReview,
  getUserReviewSummary,
} from '../src/services/review.service.js'

const reviewerId = '0123456789abcdef01234567'
const revieweeId = 'fedcba987654321001234567'
const outsiderId = 'abcdefabcdefabcdefabcdef'
const sessionId = '111111111111111111111111'

function student(id, role = 'STUDENT') {
  return { _id: id, role }
}

function sessionQuery(value) {
  return {
    select() { return this },
    lean: async () => value,
  }
}

function populatedReviewQuery(value) {
  return {
    populate() { return this },
    lean: async () => value,
  }
}

function completedSession(overrides = {}) {
  return {
    _id: sessionId,
    status: 'COMPLETED',
    participants: [reviewerId, revieweeId],
    ...overrides,
  }
}

test('review creation derives reviewer and reviewee from the completed session', async (t) => {
  t.mock.method(Session, 'findById', () => sessionQuery(completedSession()))
  t.mock.method(Review, 'exists', async () => null)
  let createdReview
  t.mock.method(Review, 'create', async (input) => {
    createdReview = input
    return { _id: '333333333333333333333333' }
  })
  const populated = { _id: '333333333333333333333333', rating: 4 }
  t.mock.method(Review, 'findById', () => populatedReviewQuery(populated))

  const result = await createReview(student(reviewerId), {
    sessionId,
    rating: 4,
    comment: 'Helpful exchange',
  })

  assert.equal(result, populated)
  assert.equal(createdReview.reviewer, reviewerId)
  assert.equal(createdReview.reviewee, revieweeId)
  assert.equal(createdReview.session, sessionId)
})

test('review creation rejects missing, incomplete, and unrelated sessions', async (t) => {
  t.mock.method(Session, 'findById', () => sessionQuery(null))
  await assert.rejects(createReview(student(reviewerId), { sessionId, rating: 5, comment: '' }), {
    code: 'SESSION_NOT_FOUND',
  })

  t.mock.restoreAll()
  t.mock.method(Session, 'findById', () => sessionQuery(completedSession({ status: 'CONFIRMED' })))
  await assert.rejects(createReview(student(reviewerId), { sessionId, rating: 5, comment: '' }), {
    code: 'SESSION_NOT_COMPLETED',
  })

  t.mock.restoreAll()
  t.mock.method(Session, 'findById', () => sessionQuery(completedSession()))
  await assert.rejects(createReview(student(outsiderId), { sessionId, rating: 5, comment: '' }), {
    code: 'REVIEW_ACCESS_DENIED',
  })

  t.mock.restoreAll()
  t.mock.method(Session, 'findById', () => sessionQuery(completedSession({ participants: [reviewerId, reviewerId] })))
  await assert.rejects(createReview(student(reviewerId), { sessionId, rating: 5, comment: '' }), {
    code: 'INVALID_REVIEWEE',
  })
})

test('duplicate reviews are rejected both before insertion and on a concurrent unique-index collision', async (t) => {
  t.mock.method(Session, 'findById', () => sessionQuery(completedSession()))
  t.mock.method(Review, 'exists', async () => ({ _id: 'existing' }))
  await assert.rejects(createReview(student(reviewerId), { sessionId, rating: 5, comment: '' }), {
    code: 'REVIEW_ALREADY_EXISTS',
  })

  t.mock.restoreAll()
  t.mock.method(Session, 'findById', () => sessionQuery(completedSession()))
  t.mock.method(Review, 'exists', async () => null)
  t.mock.method(Review, 'create', async () => { throw { code: 11000 } })
  await assert.rejects(createReview(student(reviewerId), { sessionId, rating: 5, comment: '' }), {
    code: 'REVIEW_ALREADY_EXISTS',
  })
})

test('review summaries return a safe empty reputation and filter reviews to completed valid sessions', async (t) => {
  t.mock.method(User, 'exists', async () => ({ _id: revieweeId }))
  const pipelines = []
  t.mock.method(Review, 'aggregate', async (pipeline) => {
    pipelines.push(pipeline)
    return pipelines.length === 1 ? [] : []
  })

  const result = await getUserReviewSummary(revieweeId)

  assert.deepEqual(result, {
    reputation: { averageRating: null, reviewCount: 0 },
    reviews: [],
  })
  assert.equal(pipelines.length, 2)
  for (const pipeline of pipelines) {
    assert.ok(pipeline.some((stage) => stage.$lookup?.from === Session.collection.name))
    assert.ok(pipeline.some((stage) => stage.$match?.['sessionRecord.status'] === 'COMPLETED'))
    assert.ok(pipeline.some((stage) => stage.$match?.rating?.$type === 'number'))
    assert.ok(pipeline.some((stage) => stage.$match?.['sessionRecord.participants']?.$type === 'array'))
  }
  assert.ok(pipelines[0].some((stage) => stage.$group?.averageRating?.$avg === '$rating'))
  assert.ok(pipelines[1].some((stage) => stage.$limit === 50))
})

test('review summaries calculate and round the aggregate reputation', async (t) => {
  t.mock.method(User, 'exists', async () => ({ _id: revieweeId }))
  let aggregateCall = 0
  const reviews = [{ _id: 'review', rating: 5 }]
  t.mock.method(Review, 'aggregate', async () => {
    aggregateCall += 1
    return aggregateCall === 1
      ? [{ averageRating: 4.666, reviewCount: 3 }]
      : reviews
  })

  const result = await getUserReviewSummary(revieweeId)

  assert.deepEqual(result, {
    reputation: { averageRating: 4.67, reviewCount: 3 },
    reviews,
  })
})
