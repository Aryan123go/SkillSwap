import test from 'node:test'
import assert from 'node:assert/strict'
import { createReviewSchema } from '../src/validators/review.validator.js'

const sessionId = '507f1f77bcf86cd799439011'

test('review schema accepts a valid rating and trims optional feedback', () => {
  const result = createReviewSchema.safeParse({ sessionId, rating: 4, comment: '  Helpful exchange  ' })
  assert.equal(result.success, true)
  assert.equal(result.data.comment, 'Helpful exchange')
})

test('review schema defaults an omitted comment to an empty string', () => {
  const result = createReviewSchema.safeParse({ sessionId, rating: 5 })
  assert.equal(result.success, true)
  assert.equal(result.data.comment, '')
})

test('review schema rejects invalid IDs, non-integer ratings, out-of-range ratings, and extra fields', () => {
  assert.equal(createReviewSchema.safeParse({ sessionId: 'not-an-id', rating: 5 }).success, false)
  assert.equal(createReviewSchema.safeParse({ sessionId, rating: 4.5 }).success, false)
  assert.equal(createReviewSchema.safeParse({ sessionId, rating: 0 }).success, false)
  assert.equal(createReviewSchema.safeParse({ sessionId, rating: 6 }).success, false)
  assert.equal(createReviewSchema.safeParse({ sessionId, rating: 5, reviewee: sessionId }).success, false)
  assert.equal(createReviewSchema.safeParse({ sessionId, rating: 5, comment: 'x'.repeat(501) }).success, false)
})
