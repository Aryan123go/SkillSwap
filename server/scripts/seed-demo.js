import bcrypt from 'bcryptjs'
import dotenv from 'dotenv'
import dns from 'node:dns'
import mongoose from 'mongoose'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Conversation from '../src/models/Conversation.js'
import ExchangeRequest from '../src/models/ExchangeRequest.js'
import Message from '../src/models/Message.js'
import Review from '../src/models/Review.js'
import Session from '../src/models/Session.js'
import Skill from '../src/models/Skill.js'
import User from '../src/models/User.js'
import { demoProfiles, getUnseededDemoProfiles } from '../src/data/demoProfiles.js'
import { initializeSkillCatalogue } from '../src/services/skill.service.js'
import { validateDemoSeedConfiguration } from '../src/data/demoSeedSafety.js'
import { normalizeSkill } from '../src/utils/normalizeSkill.js'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
dns.setServers([
  '8.8.8.8',
  '[2001:4860:4860::8888]',
  '8.8.8.8:1053',
  '[2001:4860:4860::8888]:1053',
])
dotenv.config({ path: path.resolve(scriptDirectory, '../.env') })

const mode = process.argv[2]

async function seedProfiles() {
  await initializeSkillCatalogue()
  const skillNames = [...new Set(demoProfiles.flatMap((profile) => [
    ...profile.skillsToTeach,
    ...profile.skillsToLearn,
  ]).map(({ name }) => normalizeSkill(name)))]
  const skills = await Skill.find({ normalizedName: { $in: skillNames }, status: 'ACTIVE' }).select('_id normalizedName').lean()
  const skillsByName = new Map(skills.map((skill) => [skill.normalizedName, skill._id]))
  const missingSkills = skillNames.filter((name) => !skillsByName.has(name))
  if (missingSkills.length) {
    throw new Error(`The active skill catalogue is missing required demo skills: ${missingSkills.join(', ')}.`)
  }

  const existing = await User.find({ email: { $in: demoProfiles.map((profile) => profile.email) } }).select('email').lean()
  const profilesToCreate = getUnseededDemoProfiles(demoProfiles, existing.map(({ email }) => email))
  if (!profilesToCreate.length) {
    console.info(`No demo accounts created; all ${demoProfiles.length} reserved demo emails already exist and were left unchanged.`)
    return
  }

  const passwordHash = await bcrypt.hash(process.env.DEMO_SEED_PASSWORD, 12)
  let created = 0
  let skippedRace = 0
  for (const profile of profilesToCreate) {
    const skillEntries = (entries) => entries.map(({ name, proficiency }) => ({
      skill: skillsByName.get(normalizeSkill(name)),
      proficiency,
    }))
    try {
      await User.create({
        name: profile.name,
        email: profile.email,
        demoSeedKey: profile.email,
        passwordHash,
        role: 'STUDENT',
        college: profile.college,
        bio: profile.bio,
        availability: profile.availability,
        skillsToTeach: skillEntries(profile.skillsToTeach),
        skillsToLearn: skillEntries(profile.skillsToLearn),
      })
      created += 1
    } catch (error) {
      if (error?.code !== 11000) throw error
      skippedRace += 1
    }
  }
  console.info(`Demo profiles created: ${created}. Existing accounts left unchanged: ${existing.length + skippedRace}.`)
}

async function resetProfiles() {
  const seedKeys = demoProfiles.map((profile) => profile.email)
  const users = await User.find({ demoSeedKey: { $in: seedKeys } }).select('_id +demoSeedKey').lean()
  if (!users.length) {
    console.info('No accounts created by this demo seeder were found; nothing was removed.')
    return
  }

  const userIds = users.map(({ _id }) => _id)
  const requests = await ExchangeRequest.find({
    $or: [{ sender: { $in: userIds } }, { recipient: { $in: userIds } }],
  }).select('_id').lean()
  const requestIds = requests.map(({ _id }) => _id)
  const [sessions, conversations] = await Promise.all([
    Session.find({
      $or: [{ participants: { $in: userIds } }, { exchangeRequest: { $in: requestIds } }],
    }).select('_id').lean(),
    Conversation.find({
      $or: [{ participants: { $in: userIds } }, { exchangeRequest: { $in: requestIds } }],
    }).select('_id').lean(),
  ])
  const sessionIds = sessions.map(({ _id }) => _id)
  const conversationIds = conversations.map(({ _id }) => _id)

  await Message.deleteMany({ conversation: { $in: conversationIds } })
  await Conversation.deleteMany({ _id: { $in: conversationIds } })
  await Review.deleteMany({
    $or: [
      { reviewer: { $in: userIds } },
      { reviewee: { $in: userIds } },
      { session: { $in: sessionIds } },
    ],
  })
  await Session.deleteMany({ _id: { $in: sessionIds } })
  await ExchangeRequest.deleteMany({ _id: { $in: requestIds } })
  const result = await User.deleteMany({ _id: { $in: userIds }, demoSeedKey: { $in: seedKeys } })
  console.info(`Removed ${result.deletedCount} seeder-owned demo accounts and their linked requests, sessions, conversations, messages, and reviews.`)
}

async function main() {
  if (process.argv.length !== 3) throw new Error('Choose exactly one explicit mode: --apply or --reset.')
  validateDemoSeedConfiguration({
    mode,
    nodeEnvironment: process.env.NODE_ENV,
    confirmation: process.env.DEMO_SEED_CONFIRM,
    mongoUri: process.env.MONGODB_URI,
    allowRemote: process.env.DEMO_SEED_ALLOW_REMOTE,
    password: process.env.DEMO_SEED_PASSWORD,
  })
  await mongoose.connect(process.env.MONGODB_URI, { dbName: 'skillswap' })
  if (mode === '--apply') await seedProfiles()
  else await resetProfiles()
}

main()
  .catch((error) => {
    console.error('Demo data operation failed:', error.message)
    process.exitCode = 1
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect()
  })
