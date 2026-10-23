import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createApp } from '../src/app.js'

const clientIndex = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist/index.html')

async function withProductionApp(run) {
  const previous = {
    nodeEnv: process.env.NODE_ENV,
    clientUrl: process.env.CLIENT_URL,
    renderExternalUrl: process.env.RENDER_EXTERNAL_URL,
  }
  process.env.NODE_ENV = 'production'
  delete process.env.CLIENT_URL
  process.env.RENDER_EXTERNAL_URL = 'https://skillswap.onrender.com'
  const server = createApp().listen(0, '127.0.0.1')
  await new Promise((resolve, reject) => {
    server.once('listening', resolve)
    server.once('error', reject)
  })
  try {
    await run(`http://127.0.0.1:${server.address().port}`)
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()))
    })
    if (previous.nodeEnv === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = previous.nodeEnv
    if (previous.clientUrl === undefined) delete process.env.CLIENT_URL
    else process.env.CLIENT_URL = previous.clientUrl
    if (previous.renderExternalUrl === undefined) delete process.env.RENDER_EXTERNAL_URL
    else process.env.RENDER_EXTERNAL_URL = previous.renderExternalUrl
  }
}

test('production accepts the generated Render origin for same-origin unsafe requests', async () => {
  await withProductionApp(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { origin: 'https://skillswap.onrender.com', 'content-type': 'application/json' },
      body: '{}',
    })
    assert.equal(response.status, 401)
    assert.equal((await response.json()).code, 'AUTHENTICATION_REQUIRED')
  })
})

test('production SPA fallback serves client routes without swallowing unknown API routes', {
  skip: !existsSync(clientIndex) && 'Run the production client build to test SPA hosting.',
}, async () => {
  await withProductionApp(async (baseUrl) => {
    const page = await fetch(`${baseUrl}/discover`, { headers: { accept: 'text/html' } })
    assert.equal(page.status, 200)
    assert.match(await page.text(), /<div id="root"><\/div>/)

    const missingApi = await fetch(`${baseUrl}/api/missing`, { headers: { accept: 'text/html' } })
    assert.equal(missingApi.status, 404)
    assert.equal((await missingApi.json()).code, 'NOT_FOUND')
  })
})
