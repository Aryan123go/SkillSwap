import mongoose from 'mongoose'
import Conversation from '../models/Conversation.js'
import ExchangeRequest from '../models/ExchangeRequest.js'
import Message from '../models/Message.js'
import { HttpError } from '../utils/HttpError.js'

const conversationPopulation = [
  { path: 'participants', select: '_id name profileImage college' },
  {
    path: 'exchangeRequest',
    select: '_id sender recipient requestedSkill offeredSkill status',
    populate: [
      { path: 'sender', select: '_id name profileImage college' },
      { path: 'recipient', select: '_id name profileImage college' },
      { path: 'requestedSkill', select: '_id name category' },
      { path: 'offeredSkill', select: '_id name category' },
    ],
  },
  { path: 'lastMessageSender', select: '_id name' },
]

function requireStudent(user) {
  if (!user || user.role !== 'STUDENT') {
    throw new HttpError(403, 'Only student accounts can use chat.', 'STUDENT_ACCOUNT_REQUIRED')
  }
}

function validateId(id, kind) {
  if (!mongoose.isValidObjectId(id)) {
    throw new HttpError(400, `Use a valid ${kind} ID.`, `INVALID_${kind.toUpperCase()}_ID`)
  }
}

function isParticipant(conversation, userId) {
  return (conversation.participants ?? []).some((id) => (id?._id ?? id).toString() === userId.toString())
}

async function getAcceptedRequestForParticipant(user, requestId) {
  validateId(requestId, 'exchange request')
  const request = await ExchangeRequest.findById(requestId)
    .select('_id sender recipient status requestedSkill offeredSkill')
    .lean()
  if (!request) throw new HttpError(404, 'This exchange request could not be found.', 'REQUEST_NOT_FOUND')
  if (request.sender.toString() !== user._id.toString() && request.recipient.toString() !== user._id.toString()) {
    throw new HttpError(403, 'You are not a participant in this exchange request.', 'CHAT_ACCESS_DENIED')
  }
  if (request.status !== 'ACCEPTED') {
    throw new HttpError(409, 'Chat is available only for accepted exchange requests.', 'CHAT_REQUEST_NOT_ACCEPTED')
  }
  return request
}

async function getOrCreateConversation(user, requestId) {
  const request = await getAcceptedRequestForParticipant(user, requestId)
  const participants = [request.sender, request.recipient]
  try {
    return await Conversation.findOneAndUpdate(
      { exchangeRequest: request._id },
      { $setOnInsert: { exchangeRequest: request._id, participants } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    )
  } catch (error) {
    if (error.code === 11000) {
      const existing = await Conversation.findOne({ exchangeRequest: request._id })
      if (existing) return existing
    }
    throw error
  }
}

async function getConversationForParticipant(user, conversationId) {
  requireStudent(user)
  validateId(conversationId, 'conversation')
  const conversation = await Conversation.findById(conversationId).lean()
  if (!conversation) throw new HttpError(404, 'This conversation could not be found.', 'CONVERSATION_NOT_FOUND')
  if (!isParticipant(conversation, user._id)) {
    throw new HttpError(403, 'You are not allowed to access this conversation.', 'CHAT_ACCESS_DENIED')
  }
  await getAcceptedRequestForParticipant(user, conversation.exchangeRequest)
  return conversation
}

export async function listConversations(user) {
  requireStudent(user)
  const acceptedRequests = await ExchangeRequest.find({
    status: 'ACCEPTED',
    $or: [{ sender: user._id }, { recipient: user._id }],
  }).select('_id sender recipient').sort({ updatedAt: -1 }).lean()

  for (const request of acceptedRequests) {
    await getOrCreateConversation(user, request._id)
  }

  const conversations = await Conversation.find({ participants: user._id })
    .sort({ lastMessageAt: -1, updatedAt: -1, _id: -1 })
    .populate(conversationPopulation)
    .lean()

  // Never expose conversations whose related exchange is no longer accepted.
  return conversations.filter((item) => item.exchangeRequest?.status === 'ACCEPTED')
}

export async function getConversation(user, conversationId) {
  await getConversationForParticipant(user, conversationId)
  const conversation = await Conversation.findById(conversationId).populate(conversationPopulation).lean()
  if (!conversation || conversation.exchangeRequest?.status !== 'ACCEPTED') {
    throw new HttpError(409, 'Chat is available only for accepted exchange requests.', 'CHAT_REQUEST_NOT_ACCEPTED')
  }
  return conversation
}

export async function getConversationForRequest(user, requestId) {
  requireStudent(user)
  const conversation = await getOrCreateConversation(user, requestId)
  return getConversation(user, conversation._id)
}

export async function listMessages(user, conversationId, query = {}) {
  await getConversationForParticipant(user, conversationId)
  const page = Math.max(1, Number(query.page) || 1)
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 50))
  const filter = { conversation: conversationId }
  const [messages, total] = await Promise.all([
    Message.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('sender', '_id name profileImage')
      .lean(),
    Message.countDocuments(filter),
  ])
  return {
    messages: messages.reverse(),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  }
}

export async function createMessage(user, conversationId, input) {
  await getConversationForParticipant(user, conversationId)
  const content = typeof input.content === 'string' ? input.content.trim() : ''
  if (!content) throw new HttpError(400, 'Write a message before sending.', 'MESSAGE_EMPTY')
  if (content.length > 2000) throw new HttpError(400, 'Messages must be 2,000 characters or fewer.', 'MESSAGE_TOO_LONG')

  const clientMessageId = typeof input.clientMessageId === 'string' ? input.clientMessageId.trim() : ''
  if (clientMessageId && clientMessageId.length > 100) {
    throw new HttpError(400, 'The message retry identifier is too long.', 'INVALID_CLIENT_MESSAGE_ID')
  }

  try {
    const message = await Message.create({
      conversation: conversationId,
      sender: user._id,
      content,
      clientMessageId: clientMessageId || null,
    })
    await Conversation.updateOne(
      { _id: conversationId, participants: user._id },
      { $set: { lastMessageAt: message.createdAt, lastMessageText: content.slice(0, 500), lastMessageSender: user._id } },
    )
    return Message.findById(message._id).populate('sender', '_id name profileImage').lean()
  } catch (error) {
    if (error.code === 11000 && clientMessageId) {
      const existing = await Message.findOne({ conversation: conversationId, sender: user._id, clientMessageId })
        .populate('sender', '_id name profileImage')
        .lean()
      if (existing) return existing
    }
    throw error
  }
}

export async function authorizeConversationRoom(user, conversationId) {
  const conversation = await getConversationForParticipant(user, conversationId)
  return conversation._id.toString()
}

export function getConversationRoom(conversationId) {
  return `conversation:${conversationId}`
}
