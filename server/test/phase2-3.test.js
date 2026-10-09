import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateMatchDetails } from '../src/services/matching.service.js'
import { createExchangeRequestSchema, requestListQuerySchema } from '../src/validators/exchange-request.validator.js'
import { discoveryQuerySchema } from '../src/validators/discovery.validator.js'
import { createApp } from '../src/app.js'

function skill(name, aliases = []) {
  return { name, aliases }
}

function entry(name, proficiency = 'BEGINNER', aliases = []) {
  return { skill: skill(name, aliases), proficiency }
}

test('matching is case and whitespace insensitive and explains one-way matches', () => {
  const details = calculateMatchDetails(
    { skillsToLearn: [entry(' React ')], skillsToTeach: [] },
    { skillsToTeach: [entry('react')], skillsToLearn: [] },
  )
  assert.equal(details.matchScore, 45)
  assert.equal(details.mutualMatchCount, 1)
  assert.equal(details.skillsTheyCanTeachMe[0].skill.name, 'react')
  assert.deepEqual(details.matchReasons, [
    'Can teach you react.',
    'Listed proficiency levels are compatible for at least one matched skill.',
  ])
})

test('mutual complementary matches rank above one-way matches deterministically', () => {
  const student = {
    skillsToLearn: [entry('React')],
    skillsToTeach: [entry('Guitar')],
  }
  const mutualCandidate = {
    skillsToTeach: [entry('react')],
    skillsToLearn: [entry('guitar')],
  }
  const oneWayCandidate = { skillsToTeach: [entry('React')], skillsToLearn: [] }
  const first = calculateMatchDetails(student, mutualCandidate)
  const second = calculateMatchDetails(student, mutualCandidate)
  assert.equal(first.matchScore, 100)
  assert.equal(first.mutualMatchCount, 2)
  assert.deepEqual(first, second)
  assert.ok(first.matchScore > calculateMatchDetails(student, oneWayCandidate).matchScore)
})

test('a mismatched proficiency does not earn the compatibility bonus', () => {
  const details = calculateMatchDetails(
    { skillsToLearn: [entry('React', 'EXPERT')], skillsToTeach: [] },
    { skillsToTeach: [entry('React', 'BEGINNER')], skillsToLearn: [] },
  )
  assert.equal(details.matchScore, 40)
  assert.equal(details.matchReasons.includes('Listed proficiency levels are compatible for at least one matched skill.'), false)
})

test('duplicate profile skill references are counted once', () => {
  const details = calculateMatchDetails(
    { skillsToLearn: [entry('React')], skillsToTeach: [] },
    { skillsToTeach: [entry('React'), entry('React')], skillsToLearn: [] },
  )
  assert.equal(details.skillsTheyCanTeachMe.length, 1)
  assert.equal(details.mutualMatchCount, 1)
})

test('matching respects stored skill aliases without counting unrelated skills', () => {
  const details = calculateMatchDetails(
    { skillsToLearn: [entry('JS')], skillsToTeach: [] },
    { skillsToTeach: [entry('JavaScript', 'ADVANCED', ['JS']), entry('Photography')] },
  )
  assert.equal(details.matchScore, 45)
  assert.equal(details.skillsTheyCanTeachMe.length, 1)
  assert.equal(details.skillsTheyCanTeachMe[0].skill.name, 'JavaScript')
})

test('empty skill profiles safely produce no match', () => {
  assert.deepEqual(calculateMatchDetails({}, {}), {
    skillsTheyCanTeachMe: [],
    skillsICanTeachThem: [],
    mutualMatchCount: 0,
    matchScore: 0,
    matchReasons: [],
  })
})

test('discovery validates IDs, proficiency, and bounded pagination', () => {
  const valid = discoveryQuerySchema.safeParse({ q: ' React ', page: '2', limit: '50', proficiency: 'ADVANCED' })
  assert.equal(valid.success, true)
  assert.equal(valid.data.q, 'React')
  assert.equal(discoveryQuerySchema.safeParse({ page: '0' }).success, false)
  assert.equal(discoveryQuerySchema.safeParse({ page: '1000001' }).success, true)
  assert.equal(discoveryQuerySchema.safeParse({ page: '999999999999999999999999' }).success, false)
  assert.equal(discoveryQuerySchema.safeParse({ limit: '51' }).success, false)
  assert.equal(discoveryQuerySchema.safeParse({ teachingSkill: 'not-an-id' }).success, false)
  assert.equal(discoveryQuerySchema.safeParse({ sort: 'popular' }).success, false)
})

test('request validation cannot set status, sender, or arbitrary extra fields', () => {
  const valid = createExchangeRequestSchema.safeParse({
    recipient: '0123456789abcdef01234567',
    requestedSkill: 'fedcba987654321001234567',
    message: '  Hello!  ',
  })
  assert.equal(valid.success, true)
  assert.equal(valid.data.message, 'Hello!')
  assert.equal(createExchangeRequestSchema.safeParse({
    recipient: '0123456789abcdef01234567',
    requestedSkill: 'fedcba987654321001234567',
    status: 'ACCEPTED',
  }).success, false)
  assert.equal(createExchangeRequestSchema.safeParse({
    recipient: '0123456789abcdef01234567',
    requestedSkill: 'fedcba987654321001234567',
    message: 'x'.repeat(501),
  }).success, false)
})

test('request history pagination is bounded', () => {
  assert.equal(requestListQuerySchema.safeParse({ page: '3', limit: '25' }).success, true)
  assert.equal(requestListQuerySchema.safeParse({ limit: '51' }).success, false)
})

test('discovery and exchange request endpoints reject unauthenticated access', async () => {
  const previousEnvironment = {
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
    const address = server.address()
    const root = `http://127.0.0.1:${address.port}/api`
    for (const path of ['/users/discover', '/users/recommendations', '/exchange-requests/sent', '/exchange-requests/received']) {
      const response = await fetch(`${root}${path}`)
      assert.equal(response.status, 401, `${path} should require a session`)
    }
    const createResponse = await fetch(`${root}/exchange-requests`, {
      method: 'POST',
      headers: { origin: 'http://localhost:5173', 'content-type': 'application/json' },
      body: '{}',
    })
    assert.equal(createResponse.status, 401)
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()))
    })
    if (previousEnvironment.nodeEnv === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = previousEnvironment.nodeEnv
    if (previousEnvironment.clientUrl === undefined) delete process.env.CLIENT_URL
    else process.env.CLIENT_URL = previousEnvironment.clientUrl
  }
})
