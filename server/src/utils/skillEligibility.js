import mongoose from 'mongoose'
import { normalizeSkill } from './normalizeSkill.js'

export const proficiencyLevels = Object.freeze({
  BEGINNER: 0,
  INTERMEDIATE: 1,
  ADVANCED: 2,
  EXPERT: 3,
})

function skillTerms(skill) {
  if (!skill || typeof skill !== 'object') return []
  return [...new Set([
    skill.normalizedName ?? skill.name,
    ...(Array.isArray(skill.aliases) ? skill.aliases : []),
  ].filter((term) => typeof term === 'string' && term.trim()).map(normalizeSkill))]
}

function idOfSkill(skill) {
  const id = skill?._id ?? skill?.id
  return id && mongoose.isValidObjectId(id) ? id.toString() : ''
}

function validEntry(entry) {
  const skill = entry?.skill
  return idOfSkill(skill)
    && skillTerms(skill).length > 0
    && Object.hasOwn(proficiencyLevels, entry.proficiency)
}

export function getEligibleOfferSkills(teachingEntries, learningEntries, openToAnySkill = false) {
  const seenIds = new Set()
  const seenTerms = new Set()
  const eligible = []
  const requirements = (learningEntries ?? []).filter(validEntry)

  for (const entry of teachingEntries ?? []) {
    if (!validEntry(entry)) continue
    const id = idOfSkill(entry.skill)
    const terms = skillTerms(entry.skill)
    if (seenIds.has(id) || terms.some((term) => seenTerms.has(term))) continue

    if (openToAnySkill) {
      eligible.push({ entry, requiredProficiency: null })
      seenIds.add(id)
      terms.forEach((term) => seenTerms.add(term))
      continue
    }

    const matchingRequirements = requirements.filter((requirement) => (
      skillTerms(requirement.skill).some((term) => terms.includes(term))
    ))
    if (!matchingRequirements.length) continue
    const requiredProficiency = matchingRequirements.reduce((highest, requirement) => (
      proficiencyLevels[requirement.proficiency] > proficiencyLevels[highest]
        ? requirement.proficiency
        : highest
    ), 'BEGINNER')
    if (proficiencyLevels[entry.proficiency] >= proficiencyLevels[requiredProficiency]) {
      eligible.push({ entry, requiredProficiency })
      seenIds.add(id)
      terms.forEach((term) => seenTerms.add(term))
    }
  }
  return eligible
}
