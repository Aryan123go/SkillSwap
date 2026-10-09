import test from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from '../src/app.js'
import { registerSchema } from '../src/validators/auth.validator.js'
import { updateUserSchema } from '../src/validators/user.validator.js'
import { normalizeSkill } from '../src/utils/normalizeSkill.js'

test('skill names normalize whitespace and casing consistently', () => {
  assert.equal(normalizeSkill(' React '), normalizeSkill('rEaCt'))
})

test('registration validates and normalizes input without accepting a role override', () => {
  const valid = registerSchema.safeParse({
    name: '  Student Name ',
    email: ' Student@Example.com ',
    password: 'a-secure-password',
  })
  assert.equal(valid.success, true)
  assert.equal(valid.data.name, 'Student Name')
  assert.equal(valid.data.email, 'Student@Example.com')
  assert.equal(registerSchema.safeParse({
    name: 'Student Name',
    email: 'student@example.com',
    password: 'a-secure-password',
    role: 'ADMIN',
  }).success, false)
})

test('registration rejects passwords that exceed bcrypt byte limits', () => {
  assert.equal(registerSchema.safeParse({
    name: 'Student Name',
    email: 'student@example.com',
    password: '🔒'.repeat(25),
  }).success, false)
})

test('profile validation rejects duplicated selected skills', () => {
  const duplicate = updateUserSchema.safeParse({
    name: 'Student Name',
    bio: '',
    college: '',
    skillsToTeach: [
      { skill: '0123456789abcdef01234567', proficiency: 'BEGINNER' },
      { skill: '0123456789abcdef01234567', proficiency: 'ADVANCED' },
    ],
    skillsToLearn: [],
  })
  assert.equal(duplicate.success, false)
})

test('profile validation does not impose an artificial skill-count cap', () => {
  const skillsToTeach = Array.from({ length: 101 }, (_, index) => ({
    skill: index.toString(16).padStart(24, '0'),
    proficiency: 'BEGINNER',
  }))
  const parsed = updateUserSchema.safeParse({
    name: 'Student Name',
    bio: '',
    college: '',
    skillsToTeach,
    skillsToLearn: [],
  })
  assert.equal(parsed.success, true)
  assert.equal(parsed.data.skillsToTeach.length, 101)
})

test('development accepts loopback Vite fallback ports while production requires an allowlisted origin', async () => {
  const previousEnvironment = {
    nodeEnv: process.env.NODE_ENV,
    clientUrl: process.env.CLIENT_URL,
  }

  async function requestStatus(environment, origin) {
    process.env.NODE_ENV = environment
    process.env.CLIENT_URL = 'http://localhost:5173'
    const server = createApp().listen(0, '127.0.0.1')
    await new Promise((resolve, reject) => {
      server.once('listening', resolve)
      server.once('error', reject)
    })

    try {
      const address = server.address()
      const response = await fetch(`http://127.0.0.1:${address.port}/api/auth/register`, {
        method: 'POST',
        headers: { origin, 'content-type': 'application/json' },
        body: '{}',
      })
      return response.status
    } finally {
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()))
      })
    }
  }

  try {
    assert.equal(await requestStatus('development', 'http://localhost:5174'), 400)
    assert.equal(await requestStatus('production', 'http://localhost:5174'), 403)
    assert.equal(await requestStatus('production', 'http://localhost:5173'), 400)
  } finally {
    if (previousEnvironment.nodeEnv === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = previousEnvironment.nodeEnv
    if (previousEnvironment.clientUrl === undefined) delete process.env.CLIENT_URL
    else process.env.CLIENT_URL = previousEnvironment.clientUrl
  }
})
