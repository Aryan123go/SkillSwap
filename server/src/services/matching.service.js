import mongoose from 'mongoose'
import Skill from '../models/Skill.js'
import User from '../models/User.js'
import { normalizeSkill } from '../utils/normalizeSkill.js'

const SCORE_WEIGHTS = Object.freeze({
  exactSkill: 10,
  aliasSkill: 7,
  skillPointsPerDirectionCap: 30,
  compatibleProficiency: 5,
  proficiencyPointsPerDirectionCap: 10,
  mutualExchange: 20,
})

const PROFICIENCY_LEVELS = Object.freeze({
  BEGINNER: 0,
  INTERMEDIATE: 1,
  ADVANCED: 2,
  EXPERT: 3,
})

function idString(value) {
  if (value?._id) return value._id.toString()
  if (typeof value === 'string') return value
  if (typeof value?.toHexString === 'function') return value.toHexString()
  return ''
}

function getSkill(entry) {
  return entry?.skill && typeof entry.skill === 'object' ? entry.skill : null
}

function skillName(skill) {
  if (!skill) return ''
  const name = skill.normalizedName || skill.name
  return typeof name === 'string' ? normalizeSkill(name) : ''
}

function skillTerms(skill) {
  const name = skillName(skill)
  const aliases = Array.isArray(skill?.aliases) ? skill.aliases : []
  return [...new Set([name, ...aliases.map((alias) => (
    typeof alias === 'string' ? normalizeSkill(alias) : ''
  ))].filter(Boolean))]
}

function proficiencyValue(entry) {
  return Object.hasOwn(PROFICIENCY_LEVELS, entry?.proficiency)
    ? PROFICIENCY_LEVELS[entry.proficiency]
    : undefined
}

function uniqueEntries(entries = []) {
  const seen = new Set()
  return entries.filter((entry) => {
    const skill = getSkill(entry)
    const key = idString(skill) || skillName(skill)
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function compareEntries(left, right) {
  const nameOrder = skillName(getSkill(left)).localeCompare(skillName(getSkill(right)), 'en')
  if (nameOrder !== 0) return nameOrder
  return idString(getSkill(left)).localeCompare(idString(getSkill(right)), 'en')
}

function scoreDirection(teacherEntries, learnerEntries, returnedSide) {
  const teachers = uniqueEntries(teacherEntries)
  const learners = uniqueEntries(learnerEntries)
  const entries = [...teachers, ...learners]
  const parent = entries.map((_entry, index) => index)
  const find = (index) => {
    if (parent[index] !== index) parent[index] = find(parent[index])
    return parent[index]
  }
  const union = (left, right) => {
    const leftRoot = find(left)
    const rightRoot = find(right)
    if (leftRoot !== rightRoot) parent[rightRoot] = leftRoot
  }
  const termOwners = new Map()
  entries.forEach((entry, index) => {
    const skill = getSkill(entry)
    for (const term of skillTerms(skill)) {
      const previousOwner = termOwners.get(term)
      if (previousOwner !== undefined) union(index, previousOwner)
      else termOwners.set(term, index)
    }
  })

  const matchesByLogicalSkill = new Map()
  teachers.forEach((teacher, teacherIndex) => {
    const teacherSkill = getSkill(teacher)
    const teacherTerms = new Set(skillTerms(teacherSkill))
    const teacherLevel = proficiencyValue(teacher)
    learners.forEach((learner, learnerIndex) => {
      const learnerSkill = getSkill(learner)
      const sharedTerms = skillTerms(learnerSkill).filter((term) => teacherTerms.has(term))
      if (!sharedTerms.length) return

      const logicalSkill = find(teacherIndex)
      const exact = skillName(teacherSkill) === skillName(learnerSkill)
      const learnerLevel = proficiencyValue(learner)
      const compatible = teacherLevel !== undefined
        && learnerLevel !== undefined
        && teacherLevel >= learnerLevel
      const pair = {
        teacher,
        learner,
        exact,
        compatible,
        sharedTerm: [...sharedTerms].sort((left, right) => left.localeCompare(right, 'en'))[0],
      }
      const group = matchesByLogicalSkill.get(logicalSkill) ?? []
      group.push(pair)
      matchesByLogicalSkill.set(logicalSkill, group)
    })
  })

  const matches = [...matchesByLogicalSkill.values()].map((pairs) => {
    const sortedPairs = [...pairs].sort((left, right) => (
      Number(right.exact) - Number(left.exact)
      || (returnedSide === 'teacher' ? compareEntries(left.teacher, right.teacher) : compareEntries(left.learner, right.learner))
      || left.sharedTerm.localeCompare(right.sharedTerm, 'en')
    ))
    const selectedPair = sortedPairs[0]
    const resultEntry = returnedSide === 'teacher' ? selectedPair.teacher : selectedPair.learner
    return {
      entry: resultEntry,
      exact: pairs.some((pair) => pair.exact),
      compatible: selectedPair.compatible,
      logicalKey: selectedPair.sharedTerm,
    }
  }).sort((left, right) => compareEntries(left.entry, right.entry) || left.logicalKey.localeCompare(right.logicalKey, 'en'))

  const skillMatchPoints = Math.min(
    SCORE_WEIGHTS.skillPointsPerDirectionCap,
    matches.reduce((total, match) => total + (match.exact ? SCORE_WEIGHTS.exactSkill : SCORE_WEIGHTS.aliasSkill), 0),
  )
  const compatibleSkillCount = matches.filter((match) => match.compatible).length
  const proficiencyBonus = Math.min(
    SCORE_WEIGHTS.proficiencyPointsPerDirectionCap,
    compatibleSkillCount * SCORE_WEIGHTS.compatibleProficiency,
  )

  return {
    entries: matches.map(({ entry }) => entry),
    skillMatchPoints,
    compatibleSkillCount,
    proficiencyBonus,
  }
}

export function calculateMatchDetails(student, candidate) {
  const theyCanTeachMe = scoreDirection(
    candidate.skillsToTeach,
    student.skillsToLearn,
    'teacher',
  )
  const iCanTeachThem = scoreDirection(
    student.skillsToTeach,
    candidate.skillsToLearn,
    'learner',
  )
  const mutual = theyCanTeachMe.entries.length > 0 && iCanTeachThem.entries.length > 0
  const mutualExchangeBonus = mutual ? SCORE_WEIGHTS.mutualExchange : 0
  const mutualMatchCount = theyCanTeachMe.entries.length + iCanTeachThem.entries.length
  const matchReasons = []

  if (theyCanTeachMe.entries.length) {
    matchReasons.push(`Can teach you ${theyCanTeachMe.entries.map((entry) => getSkill(entry)?.name).join(', ')}.`)
  }
  if (iCanTeachThem.entries.length) {
    matchReasons.push(`Wants to learn ${iCanTeachThem.entries.map((entry) => getSkill(entry)?.name).join(', ')}.`)
  }
  const compatibleCount = [
    theyCanTeachMe,
    iCanTeachThem,
  ].reduce((total, direction) => total + direction.compatibleSkillCount, 0)
  if (compatibleCount) {
    matchReasons.push(`Proficiency levels are compatible for ${compatibleCount} matched skill${compatibleCount === 1 ? '' : 's'}.`)
  }
  if (mutual) {
    matchReasons.push('Mutual exchange: both students can teach skills the other wants to learn.')
  }

  const matchScore = theyCanTeachMe.skillMatchPoints
    + iCanTeachThem.skillMatchPoints
    + theyCanTeachMe.proficiencyBonus
    + iCanTeachThem.proficiencyBonus
    + mutualExchangeBonus

  return {
    skillsTheyCanTeachMe: theyCanTeachMe.entries,
    skillsICanTeachThem: iCanTeachThem.entries,
    mutualMatchCount,
    matchScore: Math.max(0, Math.min(100, Math.trunc(matchScore))),
    matchReasons,
    scoreComponents: {
      skillMatchPoints: {
        theyCanTeachMe: theyCanTeachMe.skillMatchPoints,
        iCanTeachThem: iCanTeachThem.skillMatchPoints,
      },
      proficiencyBonus: {
        theyCanTeachMe: theyCanTeachMe.proficiencyBonus,
        iCanTeachThem: iCanTeachThem.proficiencyBonus,
      },
      mutualExchangeBonus,
    },
  }
}

function escapeRegex(value) {
  const escapeCharacter = String.fromCodePoint(92)
  const specialCharacters = new Set('.*+?^${}()|[]'.split('').concat(escapeCharacter))
  return [...value].map((character) => (
    specialCharacters.has(character) ? `${escapeCharacter}${character}` : character
  )).join('')
}

function objectId(value) {
  return mongoose.Types.ObjectId.createFromHexString(value.toString())
}

function proficiencyFilter(filters) {
  const conditions = []
  if (filters.teachingSkill) {
    conditions.push({
      skillsToTeach: {
        $elemMatch: { skill: objectId(filters.teachingSkill), proficiency: filters.proficiency },
      },
    })
  }
  if (filters.learningSkill) {
    conditions.push({
      skillsToLearn: {
        $elemMatch: { skill: objectId(filters.learningSkill), proficiency: filters.proficiency },
      },
    })
  }
  if (!conditions.length) {
    conditions.push(
      { 'skillsToTeach.proficiency': filters.proficiency },
      { 'skillsToLearn.proficiency': filters.proficiency },
    )
  }
  return conditions.length === 1 ? conditions[0] : { $or: conditions }
}

async function skillIdsForTerms(terms) {
  const normalizedTerms = [...new Set(terms.filter(Boolean))]
  if (!normalizedTerms.length) return []
  const skills = await Skill.find({
    $or: [
      { normalizedName: { $in: normalizedTerms } },
      { aliases: { $in: normalizedTerms } },
    ],
  }).select('_id').lean()
  return skills.map(({ _id }) => _id)
}

async function skillSearchCondition(query) {
  const expression = new RegExp(escapeRegex(query), 'i')
  const matchingSkills = await Skill.find({
    status: 'ACTIVE',
    $or: [{ name: expression }, { aliases: expression }],
  }).select('_id').lean()
  const conditions = [{ name: expression }]
  if (matchingSkills.length) {
    const ids = matchingSkills.map(({ _id }) => _id)
    conditions.push(
      { 'skillsToTeach.skill': { $in: ids } },
      { 'skillsToLearn.skill': { $in: ids } },
    )
  }
  return { $or: conditions }
}

async function buildDiscoveryMatch(student, filters, recommendationsOnly) {
  const conditions = []
  if (filters.teachingSkill) {
    conditions.push({ 'skillsToTeach.skill': objectId(filters.teachingSkill) })
  }
  if (filters.learningSkill) {
    conditions.push({ 'skillsToLearn.skill': objectId(filters.learningSkill) })
  }
  if (filters.proficiency) conditions.push(proficiencyFilter(filters))
  if (filters.college) {
    conditions.push({ college: { $regex: escapeRegex(filters.college), $options: 'i' } })
  }
  if (filters.q) conditions.push(await skillSearchCondition(filters.q))

  if (recommendationsOnly) {
    const [teachMeIds, teachThemIds] = await Promise.all([
      skillIdsForTerms((student.skillsToLearn ?? []).flatMap((entry) => skillTerms(getSkill(entry)))),
      skillIdsForTerms((student.skillsToTeach ?? []).flatMap((entry) => skillTerms(getSkill(entry)))),
    ])
    const complementarySkills = []
    if (teachMeIds.length) complementarySkills.push({ 'skillsToTeach.skill': { $in: teachMeIds } })
    if (teachThemIds.length) complementarySkills.push({ 'skillsToLearn.skill': { $in: teachThemIds } })
    if (!complementarySkills.length) return null
    conditions.push({ $or: complementarySkills })
  }

  return {
    role: 'STUDENT',
    _id: { $ne: objectId(student._id) },
    ...(conditions.length ? { $and: conditions } : {}),
  }
}

function compareCandidates(left, right) {
  return right.matchScore - left.matchScore
    || left.name.localeCompare(right.name, 'en', { sensitivity: 'base' })
    || left.id.localeCompare(right.id, 'en')
}

function paginationResult(students, page, limit) {
  const total = students.length
  const start = (page - 1) * limit
  return {
    students: students.slice(start, start + limit),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  }
}

function publicSkillEntries(entries = []) {
  return entries.flatMap((entry) => {
    const skill = getSkill(entry)
    if (!skill) return []
    return [{
      skill: {
        _id: skill._id,
        name: skill.name,
        category: skill.category,
        aliases: skill.aliases ?? [],
      },
      proficiency: entry.proficiency,
    }]
  })
}

export async function discoverStudents(student, filters, recommendationsOnly = false) {
  const match = await buildDiscoveryMatch(student, filters, recommendationsOnly)
  if (!match) return paginationResult([], filters.page, filters.limit)

  const candidates = await User.find(match)
    .select('_id name profileImage bio college skillsToTeach skillsToLearn')
    .populate('skillsToTeach.skill', 'name normalizedName aliases category')
    .populate('skillsToLearn.skill', 'name normalizedName aliases category')
    .lean()

  const rankedStudents = candidates
    .map((candidate) => {
      const details = calculateMatchDetails(student, candidate)
      if (recommendationsOnly && details.matchScore === 0) return null
      return {
        id: candidate._id.toString(),
        name: candidate.name,
        profileImage: candidate.profileImage,
        bio: candidate.bio,
        college: candidate.college,
        skillsToTeach: publicSkillEntries(candidate.skillsToTeach),
        skillsToLearn: publicSkillEntries(candidate.skillsToLearn),
        skillsTheyCanTeachMe: publicSkillEntries(details.skillsTheyCanTeachMe),
        skillsICanTeachThem: publicSkillEntries(details.skillsICanTeachThem),
        mutualMatchCount: details.mutualMatchCount,
        matchScore: details.matchScore,
        matchReasons: details.matchReasons,
        scoreComponents: details.scoreComponents,
      }
    })
    .filter(Boolean)
    .sort(compareCandidates)

  return paginationResult(rankedStudents, filters.page, filters.limit)
}
