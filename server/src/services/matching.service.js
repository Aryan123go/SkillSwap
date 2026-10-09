import mongoose from 'mongoose'
import Skill from '../models/Skill.js'
import User from '../models/User.js'
import { normalizeSkill } from '../utils/normalizeSkill.js'

function skillTerms(skill) {
  if (!skill || typeof skill === 'string') return []
  return [...new Set([skill.name, ...(skill.aliases ?? [])].map(normalizeSkill).filter(Boolean))]
}

const proficiencyValues = { BEGINNER: 0, INTERMEDIATE: 1, ADVANCED: 2, EXPERT: 3 }

function proficiencyEntries(entries) {
  return (entries ?? []).flatMap((entry) => {
    const terms = skillTerms(entry.skill)
    const level = proficiencyValues[entry.proficiency]
    return terms.length && level !== undefined ? [{ terms, level }] : []
  })
}

function hasCompatibleProficiency(teacherEntries, learnerEntries) {
  return teacherEntries.some((teacher) => {
    const teacherTerms = new Set(skillTerms(teacher.skill))
    return learnerEntries.some((learner) => (
      teacher.proficiency in proficiencyValues
      && learner.proficiency in proficiencyValues
      && proficiencyValues[teacher.proficiency] >= proficiencyValues[learner.proficiency]
      && skillTerms(learner.skill).some((term) => teacherTerms.has(term))
    ))
  })
}

function distinctMatchingEntries(entries, terms) {
  const distinct = new Map()
  for (const entry of entries ?? []) {
    const id = entry.skill?._id?.toString()
    const key = id ?? normalizeSkill(entry.skill?.name ?? '')
    if (key && !distinct.has(key) && skillTerms(entry.skill).some((term) => terms.has(term))) {
      distinct.set(key, entry)
    }
  }
  return [...distinct.values()]
}

export function calculateMatchDetails(student, candidate) {
  const wantedTerms = new Set((student.skillsToLearn ?? []).flatMap((entry) => skillTerms(entry.skill)))
  const teachTerms = new Set((student.skillsToTeach ?? []).flatMap((entry) => skillTerms(entry.skill)))
  const skillsTheyCanTeachMe = distinctMatchingEntries(candidate.skillsToTeach, wantedTerms)
  const skillsICanTeachThem = distinctMatchingEntries(candidate.skillsToLearn, teachTerms)
  const mutualMatchCount = skillsTheyCanTeachMe.length + skillsICanTeachThem.length
  const mutual = skillsTheyCanTeachMe.length > 0 && skillsICanTeachThem.length > 0
  const matchScore = (skillsTheyCanTeachMe.length ? 40 : 0)
    + (skillsICanTeachThem.length ? 40 : 0)
    + (hasCompatibleProficiency(candidate.skillsToTeach ?? [], student.skillsToLearn ?? []) ? 5 : 0)
    + (hasCompatibleProficiency(student.skillsToTeach ?? [], candidate.skillsToLearn ?? []) ? 5 : 0)
    + (mutual ? 10 : 0)
  const matchReasons = []
  if (skillsTheyCanTeachMe.length) {
    matchReasons.push(`Can teach you ${skillsTheyCanTeachMe.map((entry) => entry.skill.name).join(', ')}.`)
  }
  if (skillsICanTeachThem.length) {
    matchReasons.push(`Wants to learn ${skillsICanTeachThem.map((entry) => entry.skill.name).join(', ')}.`)
  }
  if (hasCompatibleProficiency(candidate.skillsToTeach ?? [], student.skillsToLearn ?? [])
    || hasCompatibleProficiency(student.skillsToTeach ?? [], candidate.skillsToLearn ?? [])) {
    matchReasons.push('Listed proficiency levels are compatible for at least one matched skill.')
  }
  if (mutual) matchReasons.push('Your skills create a complementary exchange.')

  return { skillsTheyCanTeachMe, skillsICanTeachThem, mutualMatchCount, matchScore, matchReasons }
}

function escapeRegex(value) {
  const specialCharacters = new Set('.*+?^${}()|[]'.split('').concat(String.fromCodePoint(92)))
  const escapeCharacter = String.fromCodePoint(92)
  return [...value].map((character) => (
    specialCharacters.has(character) ? `${escapeCharacter}${character}` : character
  )).join('')
}

function termsForEntries(entries) {
  return [...new Set((entries ?? []).flatMap((entry) => skillTerms(entry.skill)))]
}

function levelExpression(variable) {
  return {
    $cond: [
      { $eq: [variable, 'BEGINNER'] },
      0,
      {
        $cond: [
          { $eq: [variable, 'INTERMEDIATE'] },
          1,
          {
            $cond: [
              { $eq: [variable, 'ADVANCED'] },
              2,
              { $cond: [{ $eq: [variable, 'EXPERT'] }, 3, -1] },
            ],
          },
        ],
      },
    ],
  }
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

async function skillSearchCondition(query) {
  const expression = new RegExp(escapeRegex(query), 'i')
  const searchConditions = [{ name: expression }]
  const matchingSkills = await Skill.find({
    status: 'ACTIVE',
    $or: [{ name: expression }, { aliases: expression }],
  }).select('_id').lean()
  if (matchingSkills.length) {
    const ids = matchingSkills.map(({ _id }) => _id)
    searchConditions.push(
      { 'skillsToTeach.skill': { $in: ids } },
      { 'skillsToLearn.skill': { $in: ids } },
    )
  }
  return { $or: searchConditions }
}

async function buildDiscoveryMatch(student, filters) {
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
  return {
    role: 'STUDENT',
    _id: { $ne: objectId(student._id) },
    ...(conditions.length ? { $and: conditions } : {}),
  }
}

function scoreStages(learnEntries, teachEntries) {
  const learnTerms = [...new Set(learnEntries.flatMap((entry) => entry.terms))]
  const teachTerms = [...new Set(teachEntries.flatMap((entry) => entry.terms))]
  const keysExpression = (variable) => ({
    $concatArrays: [
      [`$$${variable}.normalizedName`],
      { $ifNull: [`$$${variable}.aliases`, []] },
    ],
  })
  const matchingCount = (docs, terms) => ({
    $size: {
      $filter: {
        input: `$${docs}`,
        as: 'skill',
        cond: {
          $gt: [
            { $size: { $setIntersection: [keysExpression('skill'), terms] } },
            0,
          ],
        },
      },
    },
  })
  const matchedByProficiency = (candidateSkills, learnerEntries) => ({
    $size: {
      $filter: {
        input: candidateSkills,
        as: 'candidateSkill',
        cond: {
          $and: [
            { $gt: [{ $size: { $setIntersection: ['$$candidateSkill.terms', learnerEntries.length ? learnerEntries.flatMap((entry) => entry.terms) : []] } }, 0] },
            {
              $anyElementTrue: [{
                $map: {
                  input: learnerEntries,
                  as: 'learner',
                  in: {
                    $and: [
                      { $gt: [{ $size: { $setIntersection: ['$$candidateSkill.terms', '$$learner.terms'] } }, 0] },
                      { $gte: ['$$candidateSkill.level', '$$learner.level'] },
                    ],
                  },
                },
              }],
            },
          ],
        },
      },
    },
  })
  const candidateSkillDetails = (docs, entriesPath) => ({
    $map: {
      input: `$${docs}`,
      as: 'skill',
      in: {
        terms: keysExpression('skill'),
        level: {
          $let: {
            vars: {
              entry: {
                $arrayElemAt: [
                  {
                    $filter: {
                      input: `$${entriesPath}`,
                      as: 'entry',
                      cond: { $eq: ['$$entry.skill', '$$skill._id'] },
                    },
                  },
                  0,
                ],
              },
            },
            in: levelExpression('$$entry.proficiency'),
          },
        },
      },
    },
  })
  return [
    {
      $lookup: {
        from: Skill.collection.name,
        localField: 'skillsToTeach.skill',
        foreignField: '_id',
        as: '_teachDocs',
      },
    },
    {
      $lookup: {
        from: Skill.collection.name,
        localField: 'skillsToLearn.skill',
        foreignField: '_id',
        as: '_learnDocs',
      },
    },
    {
      $addFields: {
        _candidateTeachSkills: candidateSkillDetails('_teachDocs', 'skillsToTeach'),
        _candidateLearnSkills: candidateSkillDetails('_learnDocs', 'skillsToLearn'),
        _teachMeCount: matchingCount('_teachDocs', learnTerms),
        _teachThemCount: matchingCount('_learnDocs', teachTerms),
      },
    },
    {
      $addFields: {
        _teachMeCompatibleCount: matchedByProficiency('$_candidateTeachSkills', learnEntries),
        _teachThemCompatibleCount: matchedByProficiency('$_candidateLearnSkills', teachEntries),
      },
    },
    {
      $addFields: {
        mutualMatchCount: { $add: ['$_teachMeCount', '$_teachThemCount'] },
        matchScore: {
          $add: [
            { $cond: [{ $gt: ['$_teachMeCount', 0] }, 40, 0] },
            { $cond: [{ $gt: ['$_teachThemCount', 0] }, 40, 0] },
            { $cond: [{ $gt: ['$_teachMeCompatibleCount', 0] }, 5, 0] },
            { $cond: [{ $gt: ['$_teachThemCompatibleCount', 0] }, 5, 0] },
            {
              $cond: [
                { $and: [{ $gt: ['$_teachMeCount', 0] }, { $gt: ['$_teachThemCount', 0] }] },
                10,
                0,
              ],
            },
          ],
        },
      },
    },
  ]
}

export async function discoverStudents(student, filters, recommendationsOnly = false) {
  const learnEntries = proficiencyEntries(student.skillsToLearn)
  const teachEntries = proficiencyEntries(student.skillsToTeach)
  const learnTerms = termsForEntries(student.skillsToLearn)
  const teachTerms = termsForEntries(student.skillsToTeach)
  const match = await buildDiscoveryMatch(student, filters)

  const pipeline = [
    { $match: match },
    ...scoreStages(learnEntries, teachEntries),
    ...(recommendationsOnly ? [{ $match: { matchScore: { $gt: 0 } } }] : []),
    { $sort: { matchScore: -1, name: 1, _id: 1 } },
    {
      $facet: {
        results: [
          { $skip: (filters.page - 1) * filters.limit },
          { $limit: filters.limit },
          {
            $project: {
              name: 1,
              profileImage: 1,
              bio: 1,
              college: 1,
              skillsToTeach: 1,
              skillsToLearn: 1,
              matchScore: 1,
              mutualMatchCount: 1,
              _teachDocs: 1,
              _learnDocs: 1,
              _teachMeCount: 1,
              _teachThemCount: 1,
              _teachMeCompatibleCount: 1,
              _teachThemCompatibleCount: 1,
            },
          },
        ],
        total: [{ $count: 'count' }],
      },
    },
  ]
  const [result] = await User.aggregate(pipeline)
  const total = result.total[0]?.count ?? 0
  const users = result.results.map((candidate) => {
    const teachDocs = new Map(candidate._teachDocs.map((skill) => [skill._id.toString(), skill]))
    const learnDocs = new Map(candidate._learnDocs.map((skill) => [skill._id.toString(), skill]))
    const safeSkills = (entries, docs) => (entries ?? []).flatMap((entry) => {
      const skill = docs.get(entry.skill.toString())
      return skill ? [{ skill: { _id: skill._id, name: skill.name, category: skill.category, aliases: skill.aliases }, proficiency: entry.proficiency }] : []
    })
    const safeCandidate = {
      id: candidate._id.toString(),
      name: candidate.name,
      profileImage: candidate.profileImage,
      bio: candidate.bio,
      college: candidate.college,
      skillsToTeach: safeSkills(candidate.skillsToTeach, teachDocs),
      skillsToLearn: safeSkills(candidate.skillsToLearn, learnDocs),
    }
    const skillsTheyCanTeachMe = distinctMatchingEntries(safeCandidate.skillsToTeach, new Set(learnTerms))
    const skillsICanTeachThem = distinctMatchingEntries(safeCandidate.skillsToLearn, new Set(teachTerms))
    const mutual = skillsTheyCanTeachMe.length > 0 && skillsICanTeachThem.length > 0
    const compatible = candidate._teachMeCompatibleCount > 0 || candidate._teachThemCompatibleCount > 0
    const matchReasons = []
    if (skillsTheyCanTeachMe.length) matchReasons.push(`Can teach you ${skillsTheyCanTeachMe.map((entry) => entry.skill.name).join(', ')}.`)
    if (skillsICanTeachThem.length) matchReasons.push(`Wants to learn ${skillsICanTeachThem.map((entry) => entry.skill.name).join(', ')}.`)
    if (compatible) matchReasons.push('Listed proficiency levels are compatible for at least one matched skill.')
    if (mutual) matchReasons.push('Your skills create a complementary exchange.')
    return {
      ...safeCandidate,
      skillsTheyCanTeachMe,
      skillsICanTeachThem,
      mutualMatchCount: skillsTheyCanTeachMe.length + skillsICanTeachThem.length,
      matchScore: candidate.matchScore,
      matchReasons,
    }
  })
  return {
    students: users,
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total,
      pages: Math.ceil(total / filters.limit),
    },
  }
}
