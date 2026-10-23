import test from 'node:test'
import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import { demoProfiles, getUnseededDemoProfiles } from '../src/data/demoProfiles.js'
import { initialSkills } from '../src/data/initialSkills.js'
import { validateDemoSeedConfiguration } from '../src/data/demoSeedSafety.js'
import User from '../src/models/User.js'
import { calculateMatchDetails } from '../src/services/matching.service.js'

const skillNames = new Set(initialSkills.map(({ name }) => name))
const proficiencyLevels = new Set(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'])

function profileEntries(entries) {
  return entries.map(({ name, proficiency }) => ({ skill: { name }, proficiency }))
}

test('demo profiles are fictional, complete, varied, and use supported catalogue skills', () => {
  assert.ok(demoProfiles.length >= 12 && demoProfiles.length <= 20)
  assert.equal(new Set(demoProfiles.map(({ email }) => email)).size, demoProfiles.length)

  for (const profile of demoProfiles) {
    assert.match(profile.email, /^demo\.[a-z.]+@profiles\.skillswap\.invalid$/)
    assert.ok(profile.name.trim().split(/\s+/).length >= 2)
    assert.ok(profile.bio.length > 40 && profile.bio.length <= 500)
    assert.ok(profile.college.length > 0 && profile.college.length <= 120)
    assert.ok(profile.skillsToTeach.length >= 2 && profile.skillsToTeach.length <= 5)
    assert.ok(profile.skillsToLearn.length >= 2 && profile.skillsToLearn.length <= 5)
    assert.ok([...profile.skillsToTeach, ...profile.skillsToLearn].every(({ name, proficiency }) => (
      skillNames.has(name) && proficiencyLevels.has(proficiency)
    )))
    assert.equal('averageRating' in profile, false)
    assert.equal('reviewCount' in profile, false)
    assert.equal('yearOfStudy' in profile, false)
    const asUser = new User({
      ...profile,
      role: 'STUDENT',
      passwordHash: 'test-hash',
      demoSeedKey: profile.email,
      skillsToTeach: profile.skillsToTeach.map(({ proficiency }) => ({
        skill: new mongoose.Types.ObjectId(),
        proficiency,
      })),
      skillsToLearn: profile.skillsToLearn.map(({ proficiency }) => ({
        skill: new mongoose.Types.ObjectId(),
        proficiency,
      })),
    })
    assert.equal(asUser.validateSync(), undefined, `Invalid User-model demo profile: ${profile.email}`)
  }
  assert.equal(User.schema.path('yearOfStudy'), undefined)
})

test('demo profiles exercise existing matching with reciprocal, partial, and zero matches', () => {
  const scores = new Set()
  let hasMutualMatch = false
  for (let learnerIndex = 0; learnerIndex < demoProfiles.length; learnerIndex += 1) {
    const learner = demoProfiles[learnerIndex]
    const learnerRecord = {
      skillsToTeach: profileEntries(learner.skillsToTeach),
      skillsToLearn: profileEntries(learner.skillsToLearn),
    }
    for (let candidateIndex = 0; candidateIndex < demoProfiles.length; candidateIndex += 1) {
      if (learnerIndex === candidateIndex) continue
      const candidate = demoProfiles[candidateIndex]
      const result = calculateMatchDetails(learnerRecord, {
        skillsToTeach: profileEntries(candidate.skillsToTeach),
        skillsToLearn: profileEntries(candidate.skillsToLearn),
      })
      scores.add(result.matchScore)
      if (result.scoreComponents.mutualExchangeBonus > 0) hasMutualMatch = true
    }
  }
  assert.ok(scores.size > 1)
  assert.ok(scores.has(0))
  assert.ok([...scores].some((score) => score > 0))
  assert.equal(hasMutualMatch, true)
})

test('repeat seed planning skips existing reserved emails without modifying them', () => {
  const firstEmail = demoProfiles[0].email
  const firstRun = getUnseededDemoProfiles(demoProfiles, [` ${firstEmail.toUpperCase()} `])
  assert.equal(firstRun.length, demoProfiles.length - 1)
  assert.equal(firstRun.some(({ email }) => email === firstEmail), false)
  assert.deepEqual(getUnseededDemoProfiles(demoProfiles, demoProfiles.map(({ email }) => email)), [])
  assert.equal(demoProfiles[0].name, 'Aarav Mehta')
})

test('seeder ownership markers and password hashes are not exposed in user JSON', () => {
  const user = new User({
    name: 'Demo Student',
    email: 'demo.student@profiles.skillswap.invalid',
    passwordHash: 'hashed-only',
    demoSeedKey: 'demo.student@profiles.skillswap.invalid',
  })
  const json = user.toJSON()
  assert.equal('passwordHash' in json, false)
  assert.equal('demoSeedKey' in json, false)
})

test('demo seeding requires explicit development confirmation and remote opt-in', () => {
  const localConfig = {
    mode: '--apply',
    nodeEnvironment: 'development',
    confirmation: 'CREATE_DEMO_DATA',
    mongoUri: 'mongodb://localhost:27017',
    password: 'local-demo-password',
  }
  assert.doesNotThrow(() => validateDemoSeedConfiguration(localConfig))
  assert.throws(() => validateDemoSeedConfiguration({ ...localConfig, nodeEnvironment: 'production' }), /development or test/)
  assert.throws(() => validateDemoSeedConfiguration({ ...localConfig, confirmation: '' }), /DEMO_SEED_CONFIRM/)
  assert.throws(() => validateDemoSeedConfiguration({ ...localConfig, password: 'short' }), /8–72/)
  assert.throws(() => validateDemoSeedConfiguration({
    ...localConfig,
    mongoUri: 'mongodb+srv://example.invalid/skillswap',
  }), /DEMO_SEED_ALLOW_REMOTE/)
  assert.doesNotThrow(() => validateDemoSeedConfiguration({
    ...localConfig,
    mode: '--reset',
    confirmation: 'RESET_DEMO_DATA',
    mongoUri: 'mongodb+srv://example.invalid/skillswap',
    allowRemote: 'true',
    password: '',
  }))
})
