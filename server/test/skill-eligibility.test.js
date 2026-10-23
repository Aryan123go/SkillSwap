import test from 'node:test'
import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import { getEligibleOfferSkills } from '../src/utils/skillEligibility.js'

function id() {
  return new mongoose.Types.ObjectId()
}

function entry(name, proficiency, aliases = []) {
  return {
    skill: { _id: id(), name, normalizedName: name.trim().toLowerCase(), aliases },
    proficiency,
  }
}

test('offered skills require matching catalogue terms and sufficient proficiency', () => {
  const teaching = entry('JavaScript', 'ADVANCED', ['JS'])
  const insufficient = entry('React', 'BEGINNER')
  const eligible = getEligibleOfferSkills(
    [insufficient, teaching],
    [entry('JS', 'INTERMEDIATE')],
  )

  assert.equal(eligible.length, 1)
  assert.equal(eligible[0].entry.skill.name, 'JavaScript')
  assert.equal(eligible[0].requiredProficiency, 'INTERMEDIATE')
})

test('the highest proficiency requirement among alias-equivalent learning entries is enforced', () => {
  const teaching = entry('JavaScript', 'ADVANCED', ['JS'])
  const eligible = getEligibleOfferSkills(
    [teaching],
    [entry('JS', 'INTERMEDIATE'), entry('ECMAScript', 'EXPERT', ['javascript'])],
  )
  assert.deepEqual(eligible, [])
})

test('open-to-any permits any valid teaching skill without a proficiency requirement', () => {
  const teaching = [entry('Guitar', 'BEGINNER'), entry('React', 'EXPERT')]
  const eligible = getEligibleOfferSkills(teaching, [], true)
  assert.equal(eligible.length, 2)
  assert.deepEqual(eligible.map(({ requiredProficiency }) => requiredProficiency), [null, null])
})

test('invalid entries are not offered and duplicate logical skills are deduplicated', () => {
  const first = entry('JavaScript', 'BEGINNER', ['JS'])
  const higherEquivalent = entry('JS', 'EXPERT', ['JavaScript'])
  const invalid = { skill: { _id: 'not-an-object-id', name: 'Python' }, proficiency: 'EXPERT' }
  const eligible = getEligibleOfferSkills(
    [invalid, first, higherEquivalent],
    [entry('JavaScript', 'BEGINNER')],
  )
  assert.equal(eligible.length, 1)
  assert.equal(eligible[0].entry.skill._id.toString(), first.skill._id.toString())
})
