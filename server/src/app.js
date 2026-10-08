import cors from 'cors'
import cookieParser from 'cookie-parser'
import express from 'express'
import authRoutes from './routes/auth.routes.js'
import userRoutes from './routes/user.routes.js'
import skillRoutes from './routes/skill.routes.js'
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js'
import { HttpError } from './utils/HttpError.js'

function isAllowedOrigin(origin) {
  const allowedOrigins = (process.env.CLIENT_URL ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
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
  const allowedOrigins = (process.env.CLIENT_URL ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)

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
  app.use(notFoundHandler)
  app.use(errorHandler)
  return app
}
