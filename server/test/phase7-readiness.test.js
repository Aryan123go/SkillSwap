import test from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from '../src/app.js'

async function withApp(run) {
  const previous = {
    nodeEnv: process.env.NODE_ENV,
    clientUrl: process.env.CLIENT_URL,
  }
  process.env.NODE_ENV = 'development'
  process.env.CLIENT_URL = 'http://localhost:5173'
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
  }
}

test('readiness: health endpoint returns the documented success payload', async () => {
  await withApp(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/health`)
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { success: true, data: { status: 'ok' } })
    assert.equal(response.headers.get('x-powered-by'), null)
  })
})

test('readiness: unknown API routes return a consistent JSON 404', async () => {
  await withApp(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/does-not-exist`)
    assert.equal(response.status, 404)
    const body = await response.json()
    assert.equal(body.success, false)
    assert.equal(body.code, 'NOT_FOUND')
  })
})

test('readiness: unsafe requests from untrusted origins are rejected', async () => {
  await withApp(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { origin: 'https://untrusted.example', 'content-type': 'application/json' },
      body: '{}',
    })
    assert.equal(response.status, 403)
    const body = await response.json()
    assert.equal(body.success, false)
    assert.equal(body.code, 'CORS_ORIGIN_DENIED')
  })
})
