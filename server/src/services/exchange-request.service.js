import mongoose from 'mongoose'
import ExchangeRequest from '../models/ExchangeRequest.js'
import Skill from '../models/Skill.js'
import User from '../models/User.js'
import { HttpError } from '../utils/HttpError.js'
import { normalizeSkill } from '../utils/normalizeSkill.js'
import { getEligibleOfferSkills, proficiencyLevels } from '../utils/skillEligibility.js'

const requestPopulate = [
  { path: 'sender', select: '_id name profileImage college' },
  { path: 'recipient', select: '_id name profileImage college' },
  { path: 'requestedSkill', select: '_id name category' },
  { path: 'offeredSkill', select: '_id name category' },
]

function requireStudent(student) {
  if (student.role !== 'STUDENT') {
    throw new HttpError(403, 'Only student accounts can use exchange requests.', 'STUDENT_ACCOUNT_REQUIRED')
  }
}

function includesSkill(entries, skillId) {
  return (entries ?? []).some((entry) => {
    const skill = entry.skill?._id ?? entry.skill
    return skill?.toString().toLowerCase() === skillId.toLowerCase()
  })
}

function skillTerms(skill) {
  return new Set([skill.normalizedName ?? skill.name, ...(Array.isArray(skill.aliases) ? skill.aliases : [])]
    .filter((term) => typeof term === 'string' && term.trim())
    .map(normalizeSkill))
}

function findEquivalentEntry(entries, selectedSkill) {
  const selectedTerms = skillTerms(selectedSkill)
  const matches = (entries ?? []).filter((entry) => {
    const skill = entry.skill
    if (!skill || typeof skill !== 'object' || !Object.hasOwn(proficiencyLevels, entry.proficiency)) return false
    return [...skillTerms(skill)].some((term) => selectedTerms.has(term))
  })
  return matches.reduce((highest, entry) => (
    !highest || proficiencyLevels[entry.proficiency] > proficiencyLevels[highest.proficiency] ? entry : highest
  ), null)
}

export async function createExchangeRequest(sender, input) {
  requireStudent(sender)
  await sender.populate([
    { path: 'skillsToTeach.skill', select: 'name normalizedName aliases' },
    { path: 'skillsToLearn.skill', select: 'name normalizedName aliases' },
  ])
  const recipientId = input.recipient.toLowerCase()
  const requestedSkillId = input.requestedSkill.toLowerCase()
  const offeredSkillId = input.offeredSkill.toLowerCase()
  if (sender._id.toString().toLowerCase() === recipientId) {
    throw new HttpError(400, 'You cannot send an exchange request to yourself.', 'SELF_REQUEST')
  }

  const [recipient, skills] = await Promise.all([
    User.findOne({ _id: recipientId, role: 'STUDENT' })
      .select('_id openToAnySkill skillsToTeach skillsToLearn')
      .populate('skillsToTeach.skill', 'name normalizedName aliases')
      .populate('skillsToLearn.skill', 'name normalizedName aliases'),
    Skill.find({ _id: { $in: [requestedSkillId, offeredSkillId] }, status: 'ACTIVE' })
      .select('_id name normalizedName aliases'),
  ])
  if (!recipient) throw new HttpError(404, 'This student could not be found.', 'RECIPIENT_NOT_FOUND')
  const skillsById = new Map(skills.map((skill) => [skill._id.toString(), skill]))
  const requestedSkill = skillsById.get(requestedSkillId)
  const offeredSkill = skillsById.get(offeredSkillId)
  if (!requestedSkill) throw new HttpError(400, 'Select an active skill from the catalogue.', 'INVALID_SKILL')
  const senderLearningEntry = sender.openToAnySkill === true
    ? null
    : findEquivalentEntry(sender.skillsToLearn, requestedSkill)
  const recipientTeachingEntry = findEquivalentEntry(recipient.skillsToTeach, requestedSkill)
  if (!senderLearningEntry && sender.openToAnySkill !== true) {
    throw new HttpError(400, 'Choose a skill from your learning interests.', 'REQUESTED_SKILL_NOT_SELECTED')
  }
  if (!recipientTeachingEntry) {
    throw new HttpError(400, 'The selected student is not offering that skill.', 'RECIPIENT_DOES_NOT_TEACH_SKILL')
  }
  if (senderLearningEntry && proficiencyLevels[recipientTeachingEntry.proficiency] < proficiencyLevels[senderLearningEntry.proficiency]) {
    throw new HttpError(400, 'The selected student does not meet your requested proficiency.', 'TEACHER_PROFICIENCY_TOO_LOW')
  }
  if (!includesSkill(sender.skillsToTeach, offeredSkillId)) {
    throw new HttpError(400, 'Select an active skill you can teach.', 'OFFERED_SKILL_NOT_SELECTED')
  }
  if (!getEligibleOfferSkills(
    sender.skillsToTeach,
    recipient.skillsToLearn,
    recipient.openToAnySkill === true,
  ).some(({ entry }) => (
    (entry.skill?._id ?? entry.skill).toString().toLowerCase() === offeredSkillId
  ))) {
    throw new HttpError(400, 'The offered skill does not meet this student’s learning requirements.', 'OFFERED_SKILL_NOT_ELIGIBLE')
  }

  try {
    const request = await ExchangeRequest.create({
      sender: sender._id,
      recipient: recipient._id,
      requestedSkill: requestedSkillId,
      offeredSkill: offeredSkillId,
      message: input.message,
    })
    return ExchangeRequest.findById(request._id).populate(requestPopulate)
  } catch (error) {
    if (error.code === 11000) {
      throw new HttpError(409, 'A pending request for this skill is already active.', 'DUPLICATE_PENDING_REQUEST')
    }
    throw error
  }
}

export async function listExchangeRequests(user, direction, query) {
  requireStudent(user)
  const ownerField = direction === 'sent' ? 'sender' : 'recipient'
  const [result] = await ExchangeRequest.aggregate([
    { $match: { [ownerField]: user._id } },
    { $sort: { createdAt: -1, _id: -1 } },
    {
      $facet: {
        requests: [
          { $skip: (query.page - 1) * query.limit },
          { $limit: query.limit },
          ...[
            ['sender', User.collection.name, 'name profileImage college'],
            ['recipient', User.collection.name, 'name profileImage college'],
            ['requestedSkill', Skill.collection.name, 'name category'],
            ['offeredSkill', Skill.collection.name, 'name category'],
          ].flatMap(([field, collection, projection]) => [
            {
              $lookup: {
                from: collection,
                let: { referenceId: `$${field}` },
                pipeline: [
                  { $match: { $expr: { $eq: ['$_id', '$$referenceId'] } } },
                  { $project: Object.fromEntries(projection.split(' ').map((key) => [key, 1])) },
                ],
                as: `_${field}`,
              },
            },
            { $set: { [field]: { $ifNull: [{ $arrayElemAt: [`$_${field}`, 0] }, null] } } },
            { $unset: `_${field}` },
          ]),
        ],
        total: [{ $count: 'count' }],
      },
    },
  ])
  const requests = result?.requests ?? []
  const total = result?.total[0]?.count ?? 0
  return { requests, pagination: { page: query.page, limit: query.limit, total, pages: Math.ceil(total / query.limit) } }
}

export async function listAcceptedExchangeRequests(user, query) {
  requireStudent(user)
  const filter = {
    status: 'ACCEPTED',
    $or: [{ sender: user._id }, { recipient: user._id }],
  }
  const [requests, total] = await Promise.all([
    ExchangeRequest.find(filter)
      .sort({ updatedAt: -1, _id: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .populate(requestPopulate)
      .lean(),
    ExchangeRequest.countDocuments(filter),
  ])
  return {
    requests,
    pagination: { page: query.page, limit: query.limit, total, pages: Math.ceil(total / query.limit) },
  }
}

export async function getExchangeRequest(user, id) {
  requireStudent(user)
  const request = await ExchangeRequest.findById(id).populate(requestPopulate).lean()
  if (!request) throw new HttpError(404, 'This exchange request could not be found.', 'REQUEST_NOT_FOUND')
  const senderId = request.sender?._id ?? request.sender
  const recipientId = request.recipient?._id ?? request.recipient
  if (senderId?.toString() !== user._id.toString() && recipientId?.toString() !== user._id.toString()) {
    throw new HttpError(403, 'You are not allowed to view this exchange request.', 'REQUEST_ACCESS_DENIED')
  }
  return request
}

export async function changeExchangeRequestStatus(user, id, action) {
  requireStudent(user)
  if (!mongoose.isValidObjectId(id)) {
    throw new HttpError(400, 'Use a valid exchange request ID.', 'INVALID_REQUEST_ID')
  }
  const ownerField = action === 'CANCELLED' ? 'sender' : 'recipient'
  const result = await ExchangeRequest.findOneAndUpdate(
    { _id: id, [ownerField]: user._id, status: 'PENDING' },
    { $set: { status: action } },
    { new: true, runValidators: true },
  ).populate(requestPopulate)
  if (result) return result

  const existing = await ExchangeRequest.findById(id).select('_id sender recipient status').lean()
  if (!existing) throw new HttpError(404, 'This exchange request could not be found.', 'REQUEST_NOT_FOUND')
  if (existing[ownerField].toString() !== user._id.toString()) {
    throw new HttpError(403, 'You are not allowed to change this exchange request.', 'REQUEST_ACCESS_DENIED')
  }
  throw new HttpError(409, 'This exchange request is no longer pending.', 'REQUEST_NOT_PENDING')
}
