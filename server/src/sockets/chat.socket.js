import { Server } from 'socket.io'
import User from '../models/User.js'
import Conversation from '../models/Conversation.js'
import { verifyToken } from '../utils/jwt.js'
import { authorizeConversationRoom, createMessage, getConversationRoom } from '../services/chat.service.js'

function allowedOrigin(origin) {
  const clientOrigins = process.env.CLIENT_URL?.trim() || process.env.RENDER_EXTERNAL_URL || ''
  const configured = clientOrigins.split(',').map((item) => item.trim()).filter(Boolean)
  if (origin && configured.includes(origin)) return true
  if (process.env.NODE_ENV !== 'production' && origin) {
    try {
      const url = new URL(origin)
      return url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)
    } catch {
      return false
    }
  }
  return false
}

function readCookie(cookieHeader, cookieName) {
  for (const part of (cookieHeader ?? '').split(';')) {
    const separator = part.indexOf('=')
    if (separator < 0) continue
    if (part.slice(0, separator).trim() === cookieName) {
      try {
        return decodeURIComponent(part.slice(separator + 1).trim())
      } catch {
        return part.slice(separator + 1).trim()
      }
    }
  }
  return null
}

function safeError(error) {
  return {
    message: error?.status && error.status < 500
      ? error.message
      : 'The chat action could not be completed. Please try again.',
    code: error?.code ?? 'CHAT_ACTION_FAILED',
  }
}

export function attachChatSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin(origin, callback) {
        if (!origin || allowedOrigin(origin)) callback(null, true)
        else callback(new Error('This origin is not allowed.'))
      },
      credentials: true,
    },
    maxHttpBufferSize: 64 * 1024,
  })

  io.use(async (socket, next) => {
    try {
      const token = readCookie(socket.handshake.headers.cookie, 'skillswap_token')
      if (!token) {
        const error = new Error('Please sign in to use chat.')
        error.data = { code: 'AUTHENTICATION_REQUIRED' }
        return next(error)
      }
      const payload = verifyToken(token)
      const user = await User.findById(payload.sub).select('_id name role')
      if (!user) {
        const error = new Error('Your session is no longer valid.')
        error.data = { code: 'INVALID_SESSION' }
        return next(error)
      }
      if (user.role !== 'STUDENT') {
        const error = new Error('Only student accounts can use chat.')
        error.data = { code: 'STUDENT_ACCOUNT_REQUIRED' }
        return next(error)
      }
      socket.data.user = user
      return next()
    } catch {
      const error = new Error('Your chat session is invalid or expired.')
      error.data = { code: 'INVALID_TOKEN' }
      return next(error)
    }
  })

  io.on('connection', (socket) => {
    // Authenticated sockets join a private user room for inbox previews and unread badges.
    socket.join(`user:${socket.data.user._id.toString()}`)
    socket.on('conversation:join', async (payload = {}, acknowledge = () => {}) => {
      try {
        const roomId = await authorizeConversationRoom(socket.data.user, payload.conversationId)
        await socket.join(getConversationRoom(roomId))
        acknowledge({ success: true, conversationId: roomId })
      } catch (error) {
        acknowledge({ success: false, error: safeError(error) })
      }
    })

    socket.on('conversation:leave', async (payload = {}, acknowledge = () => {}) => {
      try {
        const roomId = await authorizeConversationRoom(socket.data.user, payload.conversationId)
        await socket.leave(getConversationRoom(roomId))
        acknowledge({ success: true, conversationId: roomId })
      } catch (error) {
        acknowledge({ success: false, error: safeError(error) })
      }
    })

    socket.on('message:send', async (payload = {}, acknowledge = () => {}) => {
      try {
        const roomId = await authorizeConversationRoom(socket.data.user, payload.conversationId)
        const message = await createMessage(socket.data.user, roomId, {
          content: payload.content,
          clientMessageId: payload.clientMessageId,
        })
        // Persistence succeeds before the canonical message is broadcast.
        io.to(getConversationRoom(roomId)).emit('message:new', { message })
        const conversation = await Conversation.findById(roomId).select('participants').lean()
        for (const participantId of conversation?.participants ?? []) {
          io.to(`user:${participantId.toString()}`).emit('user:message', { conversationId: roomId, message })
        }
        acknowledge({ success: true, message })
      } catch (error) {
        acknowledge({ success: false, error: safeError(error) })
      }
    })
  })

  return io
}
