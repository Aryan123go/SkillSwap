import dotenv from 'dotenv'
import mongoose from 'mongoose'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { createApp } from './app.js'
import { connectDatabase } from './config/db.js'
import { initializeSkillCatalogue } from './services/skill.service.js'
import { getTokenLifetimeSeconds } from './utils/jwt.js'
import dns from 'dns'
dns.setServers([
  '8.8.8.8',
  '[2001:4860:4860::8888]',
  '8.8.8.8:1053',
  '[2001:4860:4860::8888]:1053',
]);

const serverDirectory = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(serverDirectory, '../.env') })

let httpServer
let isShuttingDown = false

async function start() {
  getTokenLifetimeSeconds()
  await connectDatabase()
  await initializeSkillCatalogue()

  const port = Number(process.env.PORT || 5000)
  const app = createApp()
  httpServer = app.listen(port, () => console.info(`SkillSwap API listening on port ${port}.`))
}

async function shutdown(signal) {
  if (isShuttingDown) return
  isShuttingDown = true
  console.info(`Received ${signal}; shutting down.`)

  try {
    if (httpServer) {
      await new Promise((resolve, reject) => {
        httpServer.close((error) => (error ? reject(error) : resolve()))
      })
    }
    await mongoose.disconnect()
    process.exit(0)
  } catch (error) {
    console.error('Graceful shutdown failed:', error)
    process.exit(1)
  }
}

process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))

start().catch((error) => {
  const knownConfigurationErrors = new Set([
    'JWT_SECRET must be configured with at least 32 characters.',
    'MONGODB_URI is required to start the server.',
    'CLIENT_URL must contain at least one allowed frontend origin.',
  ])
  if (knownConfigurationErrors.has(error.message)) {
    console.error('SkillSwap API failed to start:', error.message)
  } else {
    console.error('SkillSwap API failed to start; verify MongoDB availability and server configuration.')
  }
  process.exit(1)
})
