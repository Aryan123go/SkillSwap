import test from 'node:test'
import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import ExchangeRequest from '../src/models/ExchangeRequest.js'
import Skill from '../src/models/Skill.js'
import User from '../src/models/User.js'
import { createExchangeRequest } from '../src/services/exchange-request.service.js'

const id = () => new mongoose.Types.ObjectId()

function skill(name, aliases = []) {
  return { _id: id(), name, normalizedName: name.trim().toLowerCase(), aliases }
}

function entry(skillRecord, proficiency) {
  return { skill: skillRecord, proficiency }
}

async function withExchangeMocks(recipient, activeSkills, run) {
  const originalFindOne = User.findOne
  const originalFind = Skill.find
  const originalCreate = ExchangeRequest.create
  const originalFindById = ExchangeRequest.findById
  const savedRequest = { _id: id(), populated: true }
  let createCount = 0

  User.findOne = () => ({
    select() { return this },
    populate() { return this },
    then(resolve, reject) { return Promise.resolve(recipient).then(resolve, reject) },
  })
  Skill.find = () => ({
    select() { return this },
    then(resolve, reject) { return Promise.resolve(activeSkills).then(resolve, reject) },
  })
  ExchangeRequest.create = async () => {
    createCount += 1
    return { _id: savedRequest._id }
  }
  ExchangeRequest.findById = () => ({ populate: () => savedRequest })

  try {
    await run({ savedRequest, getCreateCount: () => createCount })
  } finally {
    User.findOne = originalFindOne
    Skill.find = originalFind
    ExchangeRequest.create = originalCreate
    ExchangeRequest.findById = originalFindById
  }
}

test('request creation validates both participants, open-to-any learning, and eligible offered proficiency', async () => {
  const requested = skill('React')
  const offered = skill('JavaScript', ['JS'])
  const recipient = {
    _id: id(),
    openToAnySkill: false,
    skillsToTeach: [entry(requested, 'ADVANCED')],
    skillsToLearn: [entry(skill('JS'), 'INTERMEDIATE')],
  }
  const sender = {
    _id: id(),
    role: 'STUDENT',
    openToAnySkill: true,
    skillsToTeach: [entry(offered, 'ADVANCED')],
    skillsToLearn: [],
    async populate() {},
  }

  await withExchangeMocks(recipient, [requested, offered], async ({ savedRequest, getCreateCount }) => {
    const result = await createExchangeRequest(sender, {
      recipient: recipient._id.toString().toUpperCase(),
      requestedSkill: requested._id.toString().toUpperCase(),
      offeredSkill: offered._id.toString().toUpperCase(),
      message: '',
    })
    assert.equal(result, savedRequest)
    assert.equal(getCreateCount(), 1)
  })
})

test('request creation rejects unowned offered skills and self-requests without insertion', async () => {
  const requested = skill('React')
  const offered = skill('JavaScript', ['JS'])
  const recipient = {
    _id: id(),
    openToAnySkill: true,
    skillsToTeach: [entry(requested, 'ADVANCED')],
    skillsToLearn: [],
  }
  const sender = {
    _id: id(),
    role: 'STUDENT',
    openToAnySkill: true,
    skillsToTeach: [],
    skillsToLearn: [],
    async populate() {},
  }

  await withExchangeMocks(recipient, [requested, offered], async ({ getCreateCount }) => {
    await assert.rejects(
      createExchangeRequest(sender, {
        recipient: recipient._id.toString(),
        requestedSkill: requested._id.toString(),
        offeredSkill: offered._id.toString(),
        message: '',
      }),
      (error) => error.code === 'OFFERED_SKILL_NOT_SELECTED',
    )
    assert.equal(getCreateCount(), 0)
    await assert.rejects(
      createExchangeRequest(sender, {
        recipient: sender._id.toString(),
        requestedSkill: requested._id.toString(),
        offeredSkill: offered._id.toString(),
        message: '',
      }),
      (error) => error.code === 'SELF_REQUEST',
    )
  })
})

test('request creation rejects offers below the recipient proficiency requirement', async () => {
  const requested = skill('React')
  const offered = skill('JavaScript', ['JS'])
  const recipient = {
    _id: id(),
    openToAnySkill: false,
    skillsToTeach: [entry(requested, 'ADVANCED')],
    skillsToLearn: [entry(skill('JS'), 'EXPERT')],
  }
  const sender = {
    _id: id(),
    role: 'STUDENT',
    openToAnySkill: true,
    skillsToTeach: [entry(offered, 'ADVANCED')],
    skillsToLearn: [],
    async populate() {},
  }

  await withExchangeMocks(recipient, [requested, offered], async ({ getCreateCount }) => {
    await assert.rejects(
      createExchangeRequest(sender, {
        recipient: recipient._id.toString(),
        requestedSkill: requested._id.toString(),
        offeredSkill: offered._id.toString(),
        message: '',
      }),
      (error) => error.code === 'OFFERED_SKILL_NOT_ELIGIBLE',
    )
    assert.equal(getCreateCount(), 0)
  })
})
