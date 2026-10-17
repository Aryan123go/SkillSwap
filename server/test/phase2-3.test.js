import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateMatchDetails } from '../src/services/matching.service.js'
import { createExchangeRequestSchema, requestListQuerySchema } from '../src/validators/exchange-request.validator.js'
import { discoveryQuerySchema } from '../src/validators/discovery.validator.js'
import { createApp } from '../src/app.js'
import Skill from '../src/models/Skill.js'
import Session from '../src/models/Session.js'
import User from '../src/models/User.js'
import { discoverStudents } from '../src/services/matching.service.js'
import { createSessionSchema, rescheduleSessionSchema, sessionListQuerySchema } from '../src/validators/session.validator.js'

function skill(name, aliases = []) {
  return { name, aliases }
}

function entry(name, proficiency = 'BEGINNER', aliases = []) {
  return { skill: skill(name, aliases), proficiency }
}

function student(skillsToLearn = [], skillsToTeach = []) {
  return { skillsToLearn, skillsToTeach }
}

test('no complementary skills have an exact score of zero', () => {
  const details = calculateMatchDetails(
    student([entry('React')]),
    { skillsToTeach: [entry('Guitar')], skillsToLearn: [] },
  )
  assert.equal(details.matchScore, 0)
  assert.equal(details.mutualMatchCount, 0)
})

test('a one-way exact match awards exact and compatible-proficiency points', () => {
  const details = calculateMatchDetails(
    student([entry(' React ', 'INTERMEDIATE')]),
    { skillsToTeach: [entry('react', 'ADVANCED')], skillsToLearn: [] },
  )
  assert.equal(details.matchScore, 15)
  assert.deepEqual(details.scoreComponents, {
    skillMatchPoints: { theyCanTeachMe: 10, iCanTeachThem: 0 },
    proficiencyBonus: { theyCanTeachMe: 5, iCanTeachThem: 0 },
    mutualExchangeBonus: 0,
  })
  assert.equal(details.mutualMatchCount, 1)
  assert.equal(details.skillsTheyCanTeachMe[0].skill.name, 'react')
  assert.deepEqual(details.matchReasons, [
    'Can teach you react.',
    'Proficiency levels are compatible for 1 matched skill.',
  ])
})

test('an alias-only match earns alias points and duplicate aliases do not add points', () => {
  const details = calculateMatchDetails(
    student([entry('JS', 'BEGINNER', ['JavaScript', ' js ', 'JAVASCRIPT'])]),
    { skillsToTeach: [entry('JavaScript', 'BEGINNER', ['JS', 'js'])], skillsToLearn: [] },
  )
  assert.equal(details.matchScore, 12)
  assert.equal(details.scoreComponents.skillMatchPoints.theyCanTeachMe, 7)
  assert.equal(details.mutualMatchCount, 1)
})

test('case and surrounding whitespace do not prevent exact matching', () => {
  const details = calculateMatchDetails(
    student([entry('  ReAcT  ')]),
    { skillsToTeach: [entry('react')], skillsToLearn: [] },
  )
  assert.equal(details.matchScore, 15)
})

test('mutual exchange earns a 20 point bonus in addition to both directions', () => {
  const details = calculateMatchDetails(
    student([entry('React')], [entry('Guitar')]),
    { skillsToTeach: [entry('React')], skillsToLearn: [entry('Guitar')] },
  )
  assert.equal(details.matchScore, 50)
  assert.equal(details.scoreComponents.mutualExchangeBonus, 20)
  assert.equal(details.mutualMatchCount, 2)
  assert.ok(details.matchReasons.includes('Mutual exchange: both students can teach skills the other wants to learn.'))
})

test('distinct exact skills increase direction points up to both caps', () => {
  const names = ['React', 'Java', 'Design', 'Python']
  const details = calculateMatchDetails(
    student(names.map((name) => entry(name))),
    { skillsToTeach: names.map((name) => entry(name)), skillsToLearn: [] },
  )
  assert.equal(details.matchScore, 40)
  assert.equal(details.scoreComponents.skillMatchPoints.theyCanTeachMe, 30)
  assert.equal(details.scoreComponents.proficiencyBonus.theyCanTeachMe, 10)
  assert.equal(details.mutualMatchCount, 4)
})

test('additional matches beyond the direction cap do not increase that direction score', () => {
  const names = ['React', 'Java', 'Design', 'Python', 'Writing']
  const details = calculateMatchDetails(
    student(names.map((name) => entry(name))),
    { skillsToTeach: names.map((name) => entry(name)), skillsToLearn: [] },
  )
  assert.equal(details.scoreComponents.skillMatchPoints.theyCanTeachMe, 30)
  assert.equal(details.scoreComponents.proficiencyBonus.theyCanTeachMe, 10)
  assert.equal(details.matchScore, 40)
})

test('proficiency bonus is earned only for matched skills with compatible levels', () => {
  const details = calculateMatchDetails(
    student([entry('React', 'EXPERT'), entry('Java', 'BEGINNER')]),
    { skillsToTeach: [entry('React', 'BEGINNER'), entry('Java', 'INTERMEDIATE')], skillsToLearn: [] },
  )
  assert.equal(details.matchScore, 25)
  assert.equal(details.scoreComponents.proficiencyBonus.theyCanTeachMe, 5)
  assert.equal(details.matchReasons[1], 'Proficiency levels are compatible for 1 matched skill.')
})

test('teacher below learner proficiency receives no compatibility bonus', () => {
  const details = calculateMatchDetails(
    student([entry('React', 'EXPERT')]),
    { skillsToTeach: [entry('React', 'BEGINNER')], skillsToLearn: [] },
  )
  assert.equal(details.matchScore, 10)
  assert.equal(details.scoreComponents.proficiencyBonus.theyCanTeachMe, 0)
  assert.equal(details.matchReasons.some((reason) => reason.includes('Proficiency')), false)
})

test('equal proficiency is compatible', () => {
  const details = calculateMatchDetails(
    student([entry('React', 'ADVANCED')]),
    { skillsToTeach: [entry('React', 'ADVANCED')], skillsToLearn: [] },
  )
  assert.equal(details.matchScore, 15)
})

test('invalid or missing proficiency values do not crash or earn bonuses', () => {
  const details = calculateMatchDetails(
    student([{ skill: skill('React'), proficiency: 'UNKNOWN' }]),
    { skillsToTeach: [{ skill: skill('React') }], skillsToLearn: [] },
  )
  assert.equal(details.matchScore, 10)
  assert.equal(details.scoreComponents.proficiencyBonus.theyCanTeachMe, 0)
})

test('duplicate profile records and overlapping aliases resolve to one logical match', () => {
  const details = calculateMatchDetails(
    student([entry('JS')]),
    { skillsToTeach: [entry('JavaScript', 'BEGINNER', ['JS']), entry('ECMAScript', 'EXPERT', ['JS'])], skillsToLearn: [] },
  )
  assert.equal(details.skillsTheyCanTeachMe.length, 1)
  assert.equal(details.mutualMatchCount, 1)
  assert.equal(details.matchScore, 12)
})

test('an exact match takes precedence over colliding alias-only catalogue matches', () => {
  const details = calculateMatchDetails(
    student([entry('React')]),
    { skillsToTeach: [entry('JavaScript', 'BEGINNER', ['React']), entry('React')], skillsToLearn: [] },
  )
  assert.equal(details.skillsTheyCanTeachMe.length, 1)
  assert.equal(details.skillsTheyCanTeachMe[0].skill.name, 'React')
  assert.equal(details.scoreComponents.skillMatchPoints.theyCanTeachMe, 10)
  assert.equal(details.matchScore, 15)
})

test('proficiency bonus follows the selected exact match, not a conflicting alias record', () => {
  const details = calculateMatchDetails(
    student([entry('React', 'EXPERT')]),
    { skillsToTeach: [entry('React', 'BEGINNER'), entry('JavaScript', 'EXPERT', ['React'])], skillsToLearn: [] },
  )
  assert.equal(details.skillsTheyCanTeachMe[0].skill.name, 'React')
  assert.equal(details.scoreComponents.skillMatchPoints.theyCanTeachMe, 10)
  assert.equal(details.scoreComponents.proficiencyBonus.theyCanTeachMe, 0)
  assert.equal(details.matchScore, 10)
  assert.equal(details.matchReasons.some((reason) => reason.includes('Proficiency')), false)
})

test('mutual match count equals the distinct returned match lists', () => {
  const details = calculateMatchDetails(
    student([entry('React'), entry('JS')], [entry('Guitar')]),
    {
      skillsToTeach: [entry('JavaScript', 'BEGINNER', ['JS']), entry('React'), entry('React')],
      skillsToLearn: [entry('Guitar'), entry('Music', 'BEGINNER', ['Guitar'])],
    },
  )
  assert.equal(details.mutualMatchCount, details.skillsTheyCanTeachMe.length + details.skillsICanTeachThem.length)
  assert.equal(details.mutualMatchCount, 3)
})

test('all calculated scores are integer values between zero and one hundred', () => {
  const names = ['React', 'Java', 'Design', 'Python']
  const details = calculateMatchDetails(
    student(names.map((name) => entry(name)), [entry('Guitar')]),
    {
      skillsToTeach: names.map((name) => entry(name)),
      skillsToLearn: [entry('Guitar')],
    },
  )
  assert.equal(Number.isInteger(details.matchScore), true)
  assert.ok(details.matchScore >= 0 && details.matchScore <= 100)
  assert.equal(details.matchScore, 75)
})

test('discovery uses canonical ranking before pagination and returns no private user fields', async (t) => {
  const candidates = [
    {
      _id: 'bbbbbbbbbbbbbbbbbbbbbbbb',
      name: 'Zed Exact',
      email: 'zed@example.com',
      passwordHash: 'not-for-api',
      skillsToTeach: [entry('JS')],
      skillsToLearn: [],
    },
    {
      _id: 'aaaaaaaaaaaaaaaaaaaaaaaa',
      name: 'Amy Alias',
      email: 'amy@example.com',
      passwordHash: 'not-for-api',
      skillsToTeach: [entry('JavaScript', 'BEGINNER', ['JS'])],
      skillsToLearn: [],
    },
  ]
  t.mock.method(User, 'find', () => ({
    select() { return this },
    populate() { return this },
    lean: async () => candidates,
  }))
  const matchingStudent = {
    _id: '0123456789abcdef01234567',
    skillsToLearn: [entry('JS')],
    skillsToTeach: [],
  }
  const firstPage = await discoverStudents(matchingStudent, { page: 1, limit: 1 })
  const secondPage = await discoverStudents(matchingStudent, { page: 2, limit: 1 })
  assert.equal(firstPage.pagination.total, 2)
  assert.equal(firstPage.students[0].name, 'Zed Exact')
  assert.equal(firstPage.students[0].matchScore, 15)
  assert.equal(secondPage.students[0].name, 'Amy Alias')
  assert.equal(secondPage.students[0].matchScore, 12)
  assert.equal('email' in firstPage.students[0], false)
  assert.equal('passwordHash' in firstPage.students[0], false)
})

test('recommendations use catalogue aliases to narrow candidates and canonical score details', async (t) => {
  const candidate = {
    _id: 'bbbbbbbbbbbbbbbbbbbbbbbb',
    name: 'JavaScript tutor',
    skillsToTeach: [entry('JavaScript', 'ADVANCED', ['JS'])],
    skillsToLearn: [],
  }
  let candidateFilter
  t.mock.method(Skill, 'find', () => ({
    select() { return this },
    lean: async () => [{ _id: '333333333333333333333333' }],
  }))
  t.mock.method(User, 'find', (filter) => {
    candidateFilter = filter
    return {
      select() { return this },
      populate() { return this },
      lean: async () => [candidate],
    }
  })
  const result = await discoverStudents({
    _id: '0123456789abcdef01234567',
    skillsToLearn: [entry('JS')],
    skillsToTeach: [],
  }, { page: 1, limit: 12 }, true)
  assert.equal(result.students.length, 1)
  assert.equal(result.students[0].matchScore, 12)
  assert.equal(result.students[0].scoreComponents.skillMatchPoints.theyCanTeachMe, 7)
  assert.ok(candidateFilter.$and.some((condition) => condition.$or?.some((item) => item['skillsToTeach.skill'])))
})

test('mutual complementary matches rank above one-way matches deterministically', () => {
  const matchingStudent = {
    skillsToLearn: [entry('React')],
    skillsToTeach: [entry('Guitar')],
  }
  const mutualCandidate = {
    skillsToTeach: [entry('react')],
    skillsToLearn: [entry('guitar')],
  }
  const oneWayCandidate = { skillsToTeach: [entry('React')], skillsToLearn: [] }
  const first = calculateMatchDetails(matchingStudent, mutualCandidate)
  const second = calculateMatchDetails(matchingStudent, mutualCandidate)
  assert.equal(first.matchScore, 50)
  assert.equal(first.mutualMatchCount, 2)
  assert.deepEqual(first, second)
  assert.ok(first.matchScore > calculateMatchDetails(matchingStudent, oneWayCandidate).matchScore)
})

test('empty skill profiles safely produce a complete zero-score result', () => {
  assert.deepEqual(calculateMatchDetails({}, {}), {
    skillsTheyCanTeachMe: [],
    skillsICanTeachThem: [],
    mutualMatchCount: 0,
    matchScore: 0,
    matchReasons: [],
    scoreComponents: {
      skillMatchPoints: { theyCanTeachMe: 0, iCanTeachThem: 0 },
      proficiencyBonus: { theyCanTeachMe: 0, iCanTeachThem: 0 },
      mutualExchangeBonus: 0,
    },
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

const validSchedule = {
  exchangeRequest: '0123456789abcdef01234567',
  title: 'React mentoring',
  description: 'Build a small component.',
  startAt: '2030-01-01T12:00:00.000Z',
  endAt: '2030-01-01T13:00:00.000Z',
}

test('session request validation accepts timezone-aware ISO dates and rejects invalid dates/durations', () => {
  assert.equal(createSessionSchema.safeParse(validSchedule).success, true)
  assert.equal(createSessionSchema.safeParse({ ...validSchedule, startAt: 'tomorrow' }).success, false)
  assert.equal(createSessionSchema.safeParse({ ...validSchedule, endAt: validSchedule.startAt }).success, false)
  assert.equal(createSessionSchema.safeParse({
    ...validSchedule,
    endAt: '2030-01-01T12:10:00.000Z',
  }).success, false)
  assert.equal(rescheduleSessionSchema.safeParse({
    startAt: '2030-01-01T12:00:00.000Z',
    endAt: '2030-01-01T16:30:00.000Z',
  }).success, false)
  assert.equal(createSessionSchema.safeParse({ ...validSchedule, organizer: '0123456789abcdef01234567' }).success, false)
})

test('session list filters and pagination are bounded', () => {
  assert.equal(sessionListQuerySchema.safeParse({ status: 'CONFIRMED', period: 'upcoming', page: '2', limit: '25' }).success, true)
  assert.equal(sessionListQuerySchema.safeParse({ status: 'OPEN' }).success, false)
  assert.equal(sessionListQuerySchema.safeParse({ limit: '51' }).success, false)
})

test('session model enforces participants, ordered dates, and sensible duration', async () => {
  const sender = '0123456789abcdef01234567'
  const recipient = 'fedcba987654321001234567'
  const valid = new Session({
    exchangeRequest: 'abcdefabcdefabcdefabcdef',
    organizer: sender,
    participants: [sender, recipient],
    title: 'React mentoring',
    startAt: new Date('2030-01-01T12:00:00Z'),
    endAt: new Date('2030-01-01T13:00:00Z'),
  })
  assert.equal((await valid.validate().then(() => null, (error) => error)), null)
  const duplicateParticipant = new Session({
    exchangeRequest: 'abcdefabcdefabcdefabcdef',
    organizer: sender,
    participants: [sender, sender],
    title: 'React mentoring',
    startAt: new Date('2030-01-01T12:00:00Z'),
    endAt: new Date('2030-01-01T13:00:00Z'),
  })
  await assert.rejects(duplicateParticipant.validate())
  const invalidOrganizer = new Session({
    exchangeRequest: 'abcdefabcdefabcdefabcdef',
    organizer: 'abcdefabcdefabcdefabcdef',
    participants: [sender, recipient],
    title: 'React mentoring',
    startAt: new Date('2030-01-01T12:00:00Z'),
    endAt: new Date('2030-01-01T13:00:00Z'),
  })
  await assert.rejects(invalidOrganizer.validate())
  const invalidDuration = new Session({
    exchangeRequest: 'abcdefabcdefabcdefabcdef',
    organizer: sender,
    participants: [sender, recipient],
    title: 'React mentoring',
    startAt: new Date('2030-01-01T12:00:00Z'),
    endAt: new Date('2030-01-01T12:10:00Z'),
  })
  await assert.rejects(invalidDuration.validate())
})

test('protected discovery, request, and session endpoints reject unauthenticated access', async () => {
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
    for (const path of [
      '/users/discover',
      '/users/recommendations',
      '/exchange-requests/sent',
      '/exchange-requests/received',
      '/exchange-requests/accepted',
      '/sessions',
      '/sessions/0123456789abcdef01234567',
    ]) {
      const response = await fetch(`${root}${path}`)
      assert.equal(response.status, 401, `${path} should require a session`)
    }
    const createResponse = await fetch(`${root}/sessions`, {
      method: 'POST',
      headers: { origin: 'http://localhost:5173', 'content-type': 'application/json' },
      body: JSON.stringify(validSchedule),
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
