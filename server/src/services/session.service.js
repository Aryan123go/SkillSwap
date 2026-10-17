import mongoose from 'mongoose'
import ExchangeRequest from '../models/ExchangeRequest.js'
import Session from '../models/Session.js'
import { HttpError } from '../utils/HttpError.js'

const sessionPopulation = [
  { path: 'organizer', select: '_id name profileImage college' },
  { path: 'participants', select: '_id name profileImage college' },
  {
    path: 'exchangeRequest',
    select: 'sender recipient requestedSkill offeredSkill status',
    populate: [
      { path: 'sender', select: '_id name profileImage college' },
      { path: 'recipient', select: '_id name profileImage college' },
      { path: 'requestedSkill', select: '_id name category' },
      { path: 'offeredSkill', select: '_id name category' },
    ],
  },
]

function requireStudent(user) {
  if (user.role !== 'STUDENT') {
    throw new HttpError(403, 'Only student accounts can manage sessions.', 'STUDENT_ACCOUNT_REQUIRED')
  }
}

function requireValidId(id, kind) {
  if (!mongoose.isValidObjectId(id)) {
    throw new HttpError(400, `Use a valid ${kind} ID.`, `INVALID_${kind.toUpperCase()}_ID`)
  }
}

function belongsToSession(session, userId) {
  return session.participants.some((participant) => (
    (participant?._id ?? participant).toString() === userId.toString()
  ))
}

function populateSession(query) {
  return query.populate(sessionPopulation)
}

async function findSessionForParticipant(user, id) {
  requireStudent(user)
  requireValidId(id, 'session')
  const session = await Session.findById(id).select('+revision').lean()
  if (!session) throw new HttpError(404, 'This session could not be found.', 'SESSION_NOT_FOUND')
  if (!belongsToSession(session, user._id)) {
    throw new HttpError(403, 'You are not allowed to access this session.', 'SESSION_ACCESS_DENIED')
  }
  return session
}

async function returnUpdatedSession(query) {
  const session = await populateSession(query).lean()
  if (!session) {
    throw new HttpError(409, 'This session changed before your action could be saved.', 'SESSION_STATE_CHANGED')
  }
  return session
}

export async function createSession(user, input) {
  requireStudent(user)
  const startAt = new Date(input.startAt)
  const endAt = new Date(input.endAt)
  if (startAt <= new Date()) {
    throw new HttpError(400, 'Choose a session start time in the future.', 'SESSION_START_NOT_FUTURE')
  }

  const request = await ExchangeRequest.findById(input.exchangeRequest)
    .select('_id sender recipient status')
    .lean()
  if (!request) throw new HttpError(404, 'This exchange request could not be found.', 'REQUEST_NOT_FOUND')
  if (request.status !== 'ACCEPTED') {
    throw new HttpError(409, 'Sessions can only be proposed for accepted exchange requests.', 'REQUEST_NOT_ACCEPTED')
  }
  const participantIds = [request.sender.toString(), request.recipient.toString()]
  if (!participantIds.includes(user._id.toString())) {
    throw new HttpError(403, 'Only participants of the exchange request can propose a session.', 'SESSION_ACCESS_DENIED')
  }

  const session = await Session.create({
    exchangeRequest: request._id,
    organizer: user._id,
    participants: [request.sender, request.recipient],
    title: input.title,
    description: input.description,
    startAt,
    endAt,
  })
  return populateSession(Session.findById(session._id)).lean()
}

export async function listSessions(user, query) {
  requireStudent(user)
  const filter = { participants: user._id }
  if (query.status) filter.status = query.status
  if (query.period === 'upcoming') {
    filter.status = query.status ?? { $in: ['PROPOSED', 'CONFIRMED'] }
    filter.endAt = { $gte: new Date() }
  } else if (query.period === 'past') {
    filter.$or = [
      { endAt: { $lt: new Date() } },
      { status: { $in: ['DECLINED', 'CANCELLED', 'COMPLETED'] } },
    ]
  }
  const sort = query.period === 'upcoming'
    ? { startAt: 1, _id: 1 }
    : { startAt: -1, _id: -1 }
  const [sessions, total] = await Promise.all([
    populateSession(Session.find(filter)
      .sort(sort)
      .skip((query.page - 1) * query.limit)
      .limit(query.limit))
      .lean(),
    Session.countDocuments(filter),
  ])
  return {
    sessions,
    pagination: { page: query.page, limit: query.limit, total, pages: Math.ceil(total / query.limit) },
  }
}

export async function getSession(user, id) {
  const session = await findSessionForParticipant(user, id)
  return populateSession(Session.findById(session._id)).lean()
}

export async function confirmSession(user, id) {
  const session = await findSessionForParticipant(user, id)
  if (session.status !== 'PROPOSED') {
    throw new HttpError(409, 'Only a proposed session can be confirmed.', 'INVALID_SESSION_TRANSITION')
  }
  if (session.startAt <= new Date()) {
    throw new HttpError(409, 'This proposed session has already started; reschedule it before confirming.', 'SESSION_START_PASSED')
  }
  if (session.organizer.toString() === user._id.toString()) {
    throw new HttpError(403, 'Only the other participant can confirm this proposal.', 'SESSION_ACTION_NOT_ALLOWED')
  }
  return returnUpdatedSession(Session.findOneAndUpdate(
    { _id: session._id, status: 'PROPOSED', organizer: { $ne: user._id }, participants: user._id },
    { $set: { status: 'CONFIRMED' } },
    { new: true, runValidators: true },
  ))
}

export async function declineSession(user, id) {
  const session = await findSessionForParticipant(user, id)
  if (session.status !== 'PROPOSED') {
    throw new HttpError(409, 'Only a proposed session can be declined.', 'INVALID_SESSION_TRANSITION')
  }
  if (session.organizer.toString() === user._id.toString()) {
    throw new HttpError(403, 'Only the other participant can decline this proposal.', 'SESSION_ACTION_NOT_ALLOWED')
  }
  return returnUpdatedSession(Session.findOneAndUpdate(
    { _id: session._id, status: 'PROPOSED', organizer: { $ne: user._id }, participants: user._id },
    { $set: { status: 'DECLINED' } },
    { new: true, runValidators: true },
  ))
}

export async function cancelSession(user, id) {
  const session = await findSessionForParticipant(user, id)
  if (!['PROPOSED', 'CONFIRMED'].includes(session.status)) {
    throw new HttpError(409, 'Only proposed or confirmed sessions can be cancelled.', 'INVALID_SESSION_TRANSITION')
  }
  return returnUpdatedSession(Session.findOneAndUpdate(
    { _id: session._id, status: { $in: ['PROPOSED', 'CONFIRMED'] }, participants: user._id },
    { $set: { status: 'CANCELLED' } },
    { new: true, runValidators: true },
  ))
}

export async function rescheduleSession(user, id, input) {
  const session = await findSessionForParticipant(user, id)
  if (!['PROPOSED', 'CONFIRMED'].includes(session.status)) {
    throw new HttpError(409, 'Only proposed or confirmed sessions can be rescheduled.', 'INVALID_SESSION_TRANSITION')
  }
  const startAt = new Date(input.startAt)
  if (startAt <= new Date()) {
    throw new HttpError(400, 'Choose a session start time in the future.', 'SESSION_START_NOT_FUTURE')
  }
  return returnUpdatedSession(Session.findOneAndUpdate(
    {
      _id: session._id,
      status: session.status,
      revision: session.revision,
      participants: user._id,
    },
    {
      $set: {
        organizer: user._id,
        startAt,
        endAt: new Date(input.endAt),
        status: 'PROPOSED',
      },
      $inc: { revision: 1 },
    },
    { new: true, runValidators: true },
  ))
}

export async function completeSession(user, id) {
  const session = await findSessionForParticipant(user, id)
  if (session.status !== 'CONFIRMED') {
    throw new HttpError(409, 'Only a confirmed session can be completed.', 'INVALID_SESSION_TRANSITION')
  }
  if (session.endAt > new Date()) {
    throw new HttpError(409, 'A session can be completed only after its scheduled end time.', 'SESSION_NOT_ENDED')
  }
  return returnUpdatedSession(Session.findOneAndUpdate(
    { _id: session._id, status: 'CONFIRMED', endAt: { $lte: new Date() }, participants: user._id },
    { $set: { status: 'COMPLETED' } },
    { new: true, runValidators: true },
  ))
}
