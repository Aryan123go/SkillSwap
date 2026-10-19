import test from 'node:test'
import assert from 'node:assert/strict'
import ExchangeRequest from '../src/models/ExchangeRequest.js'
import Session from '../src/models/Session.js'
import {
  cancelSession,
  completeSession,
  confirmSession,
  createSession,
  declineSession,
  rescheduleSession,
} from '../src/services/session.service.js'

const senderId = '0123456789abcdef01234567'
const recipientId = 'fedcba987654321001234567'
const outsiderId = 'abcdefabcdefabcdefabcdef'
const sessionId = '111111111111111111111111'
const requestId = '222222222222222222222222'

function participant(id) {
  return { _id: id, role: 'STUDENT' }
}

function sessionRecord(overrides = {}) {
  return {
    _id: sessionId,
    exchangeRequest: requestId,
    organizer: senderId,
    participants: [senderId, recipientId],
    title: 'React mentoring',
    description: '',
    startAt: new Date(Date.now() + 60 * 60_000),
    endAt: new Date(Date.now() + 2 * 60 * 60_000),
    status: 'PROPOSED',
    revision: 4,
    updatedAt: new Date(),
    ...overrides,
  }
}

function readQuery(value) {
  return {
    select() { return this },
    lean: async () => value,
  }
}

function populatedQuery(value) {
  return {
    populate() { return this },
    lean: async () => value,
  }
}

test('only the other participant can confirm or decline a proposal', async (t) => {
  const record = sessionRecord()
  t.mock.method(Session, 'findById', () => readQuery(record))
  await assert.rejects(confirmSession(participant(senderId), sessionId), { code: 'SESSION_ACTION_NOT_ALLOWED' })
  await assert.rejects(declineSession(participant(senderId), sessionId), { code: 'SESSION_ACTION_NOT_ALLOWED' })
  await assert.rejects(confirmSession(participant(outsiderId), sessionId), { code: 'SESSION_ACCESS_DENIED' })
})

test('terminal sessions cannot be cancelled or reopened', async (t) => {
  const record = sessionRecord({ status: 'DECLINED' })
  t.mock.method(Session, 'findById', () => readQuery(record))
  await assert.rejects(cancelSession(participant(senderId), sessionId), { code: 'INVALID_SESSION_TRANSITION' })
  await assert.rejects(confirmSession(participant(recipientId), sessionId), { code: 'INVALID_SESSION_TRANSITION' })
})

test('a confirmed session cannot be marked complete before its scheduled end', async (t) => {
  const record = sessionRecord({
    status: 'CONFIRMED',
    endAt: new Date(Date.now() + 60_000),
  })
  t.mock.method(Session, 'findById', () => readQuery(record))
  await assert.rejects(completeSession(participant(recipientId), sessionId), { code: 'SESSION_NOT_ENDED' })
})

test('a proposed session cannot be confirmed after its start time', async (t) => {
  const record = sessionRecord({
    startAt: new Date(Date.now() - 60_000),
    endAt: new Date(Date.now() + 60_000),
  })
  t.mock.method(Session, 'findById', () => readQuery(record))
  await assert.rejects(confirmSession(participant(recipientId), sessionId), { code: 'SESSION_START_PASSED' })
})

test('confirm uses an atomic expected-status and participant update', async (t) => {
  const record = sessionRecord()
  const updated = { ...record, status: 'CONFIRMED' }
  let capturedFilter
  t.mock.method(Session, 'findById', () => readQuery(record))
  t.mock.method(Session, 'findOneAndUpdate', (filter) => {
    capturedFilter = filter
    return populatedQuery(updated)
  })

  const result = await confirmSession(participant(recipientId), sessionId)
  assert.equal(result.status, 'CONFIRMED')
  assert.equal(capturedFilter.status, 'PROPOSED')
  assert.equal(capturedFilter.organizer.$ne, recipientId)
  assert.equal(capturedFilter.participants, recipientId)
})

test('a stale reschedule loses with a revision check instead of overwriting a concurrent action', async (t) => {
  const record = sessionRecord({ status: 'CONFIRMED', revision: 9 })
  let capturedFilter
  let capturedUpdate
  t.mock.method(Session, 'findById', () => readQuery(record))
  t.mock.method(Session, 'findOneAndUpdate', (filter, update) => {
    capturedFilter = filter
    capturedUpdate = update
    return populatedQuery(null)
  })

  await assert.rejects(rescheduleSession(participant(recipientId), sessionId, {
    startAt: new Date(Date.now() + 3 * 60 * 60_000).toISOString(),
    endAt: new Date(Date.now() + 4 * 60 * 60_000).toISOString(),
  }), { code: 'SESSION_STATE_CHANGED' })
  assert.equal(capturedFilter.revision, 9)
  assert.equal(capturedFilter.status, 'CONFIRMED')
  assert.equal(capturedUpdate.$inc.revision, 1)
  assert.equal(capturedUpdate.$set.status, 'PROPOSED')
  assert.equal(capturedUpdate.$set.organizer, recipientId)
})

test('invalid and missing session IDs return explicit errors', async (t) => {
  await assert.rejects(confirmSession(participant(recipientId), 'not-a-session-id'), {
    code: 'INVALID_SESSION_ID',
  })

  t.mock.method(Session, 'findById', () => readQuery(null))
  await assert.rejects(confirmSession(participant(recipientId), sessionId), {
    code: 'SESSION_NOT_FOUND',
  })
})

test('decline and cancellation apply only the permitted atomic status transitions', async (t) => {
  const record = sessionRecord()
  let capturedFilter
  t.mock.method(Session, 'findById', () => readQuery(record))
  t.mock.method(Session, 'findOneAndUpdate', (filter) => {
    capturedFilter = filter
    return populatedQuery({ ...record, status: 'DECLINED' })
  })

  const declined = await declineSession(participant(recipientId), sessionId)
  assert.equal(declined.status, 'DECLINED')
  assert.equal(capturedFilter.status, 'PROPOSED')
  assert.equal(capturedFilter.organizer.$ne, recipientId)

  t.mock.restoreAll()
  const confirmed = sessionRecord({ status: 'CONFIRMED' })
  t.mock.method(Session, 'findById', () => readQuery(confirmed))
  t.mock.method(Session, 'findOneAndUpdate', (filter) => {
    capturedFilter = filter
    return populatedQuery({ ...confirmed, status: 'CANCELLED' })
  })

  const cancelled = await cancelSession(participant(senderId), sessionId)
  assert.equal(cancelled.status, 'CANCELLED')
  assert.deepEqual(capturedFilter.status, { $in: ['PROPOSED', 'CONFIRMED'] })
})

test('rescheduling a valid session returns it to proposed status for reconfirmation', async (t) => {
  const record = sessionRecord({ status: 'CONFIRMED', revision: 2 })
  const startAt = new Date(Date.now() + 3 * 60 * 60_000)
  const endAt = new Date(startAt.getTime() + 60 * 60_000)
  let capturedFilter
  let capturedUpdate
  t.mock.method(Session, 'findById', () => readQuery(record))
  t.mock.method(Session, 'findOneAndUpdate', (filter, update) => {
    capturedFilter = filter
    capturedUpdate = update
    return populatedQuery({ ...record, ...update.$set, status: 'PROPOSED' })
  })

  const updated = await rescheduleSession(participant(recipientId), sessionId, {
    startAt: startAt.toISOString(),
    endAt: endAt.toISOString(),
  })
  assert.equal(updated.status, 'PROPOSED')
  assert.equal(capturedFilter.revision, 2)
  assert.equal(capturedUpdate.$set.organizer, recipientId)
  assert.equal(capturedUpdate.$set.startAt.getTime(), startAt.getTime())
  assert.equal(capturedUpdate.$inc.revision, 1)
})

test('a confirmed session can be completed only after its end and uses an atomic transition', async (t) => {
  const record = sessionRecord({
    status: 'CONFIRMED',
    startAt: new Date(Date.now() - 2 * 60 * 60_000),
    endAt: new Date(Date.now() - 60 * 60_000),
  })
  let capturedFilter
  t.mock.method(Session, 'findById', () => readQuery(record))
  t.mock.method(Session, 'findOneAndUpdate', (filter) => {
    capturedFilter = filter
    return populatedQuery({ ...record, status: 'COMPLETED' })
  })

  const completed = await completeSession(participant(recipientId), sessionId)
  assert.equal(completed.status, 'COMPLETED')
  assert.equal(capturedFilter.status, 'CONFIRMED')
  assert.ok(capturedFilter.endAt.$lte instanceof Date)
  assert.equal(capturedFilter.participants, recipientId)
})

test('only participants of accepted requests can create sessions and participant IDs come from the request', async (t) => {
  t.mock.method(ExchangeRequest, 'findById', () => ({
    select() { return this },
    lean: async () => ({ _id: requestId, sender: senderId, recipient: recipientId, status: 'PENDING' }),
  }))
  await assert.rejects(createSession(participant(senderId), {
    exchangeRequest: requestId,
    title: 'React mentoring',
    startAt: new Date(Date.now() + 60 * 60_000).toISOString(),
    endAt: new Date(Date.now() + 2 * 60 * 60_000).toISOString(),
  }), { code: 'REQUEST_NOT_ACCEPTED' })

  t.mock.restoreAll()
  t.mock.method(ExchangeRequest, 'findById', () => ({
    select() { return this },
    lean: async () => ({ _id: requestId, sender: senderId, recipient: recipientId, status: 'ACCEPTED' }),
  }))
  const createSpy = t.mock.method(Session, 'create', async (input) => ({ _id: sessionId, ...input }))
  t.mock.method(Session, 'findById', () => populatedQuery({ _id: sessionId, organizer: senderId, participants: [senderId, recipientId] }))

  await createSession(participant(outsiderId), {
    exchangeRequest: requestId,
    title: 'React mentoring',
    startAt: new Date(Date.now() + 60 * 60_000).toISOString(),
    endAt: new Date(Date.now() + 2 * 60 * 60_000).toISOString(),
  }).then(
    () => assert.fail('An unrelated user must not be able to schedule the request'),
    (error) => assert.equal(error.code, 'SESSION_ACCESS_DENIED'),
  )
  assert.equal(createSpy.mock.callCount(), 0)

  const created = await createSession(participant(senderId), {
    exchangeRequest: requestId,
    title: 'React mentoring',
    startAt: new Date(Date.now() + 60 * 60_000).toISOString(),
    endAt: new Date(Date.now() + 2 * 60 * 60_000).toISOString(),
  })
  assert.equal(created.organizer, senderId)
  assert.deepEqual(created.participants, [senderId, recipientId])
})
