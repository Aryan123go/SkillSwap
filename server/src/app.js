import cors from 'cors'
import cookieParser from 'cookie-parser'
import express from 'express'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import authRoutes from './routes/auth.routes.js'
import userRoutes from './routes/user.routes.js'
import skillRoutes from './routes/skill.routes.js'
import exchangeRequestRoutes from './routes/exchange-request.routes.js'
import sessionRoutes from './routes/session.routes.js'
import chatRoutes from './routes/chat.routes.js'
import reviewRoutes from './routes/review.routes.js'
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js'
import { HttpError } from './utils/HttpError.js'

const clientBuildDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist')

function configuredOrigins() {
  const clientOrigins = process.env.CLIENT_URL?.trim() || process.env.RENDER_EXTERNAL_URL || ''
  return clientOrigins.split(',').map((origin) => origin.trim()).filter(Boolean)
}

function isAllowedOrigin(origin) {
  const allowedOrigins = configuredOrigins()
  if (allowedOrigins.includes(origin)) return true

  if (process.env.NODE_ENV !== 'production') {
    try {
      const url = new URL(origin)
      return url.protocol === 'http:'
        && (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
    } catch {
      return false
    }
  }
  return false
}

function requireTrustedOrigin(request, _response, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    next()
    return
  }

  if (!request.get('origin') || !isAllowedOrigin(request.get('origin'))) {
    next(new HttpError(403, 'This request origin is not allowed.', 'REQUEST_ORIGIN_DENIED'))
    return
  }
  next()
}

export function createApp() {
  const allowedOrigins = configuredOrigins()

  if (allowedOrigins.length === 0) {
    throw new Error('CLIENT_URL must contain at least one allowed frontend origin.')
  }

  const app = express()
  app.disable('x-powered-by')
  app.use(cors({
    origin(origin, callback) {
      if (!origin || isAllowedOrigin(origin)) {
        callback(null, true)
        return
      }
      callback(new HttpError(403, 'This origin is not allowed.', 'CORS_ORIGIN_DENIED'))
    },
    credentials: true,
  }))
  app.use(express.json({ limit: '32kb' }))
  app.use(cookieParser())
  app.use(requireTrustedOrigin)

  app.get('/api/health', (_request, response) => {
    response.json({ success: true, data: { status: 'ok' } })
  })
  app.use('/api/auth', authRoutes)
  app.use('/api/users', userRoutes)
  app.use('/api/skills', skillRoutes)
  app.use('/api/exchange-requests', exchangeRequestRoutes)
  app.use('/api/sessions', sessionRoutes)
  app.use('/api/conversations', chatRoutes)
  app.use('/api/reviews', reviewRoutes)

  if (process.env.NODE_ENV === 'production' && existsSync(path.join(clientBuildDirectory, 'index.html'))) {
    app.use(express.static(clientBuildDirectory, { index: false }))
    app.get(/.*/, (request, response, next) => {
      if (request.path === '/api' || request.path.startsWith('/api/') || request.path.startsWith('/socket.io/')) {
        next()
        return
      }
      if (!request.accepts('html')) {
        next()
        return
      }
      response.sendFile(path.join(clientBuildDirectory, 'index.html'), (error) => {
        if (error) next(error)
      })
    })
  }

  app.use(notFoundHandler)
  app.use(errorHandler)
  return app
}
