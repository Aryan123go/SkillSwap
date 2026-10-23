export function getSkillId(skill) {
  return typeof skill === 'string' ? skill : skill?._id ?? skill?.id
}

export function capitalize(value) {
  return value.charAt(0) + value.slice(1).toLowerCase()
}

export const PROFICIENCIES = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT']

export function getEligibleOfferSkills(teachingEntries = [], learningEntries = [], openToAnySkill = false) {
  const seenIds = new Set()
  const seenTerms = new Set()
  const eligible = []
  const level = (proficiency) => PROFICIENCIES.indexOf(proficiency)
  const termsFor = (skill) => {
    if (!skill || typeof skill !== 'object') return []
    const aliases = Array.isArray(skill.aliases) ? skill.aliases : []
    return [...new Set([skill.normalizedName ?? skill.name, ...aliases]
      .filter((term) => typeof term === 'string' && term.trim())
      .map((term) => term.trim().toLocaleLowerCase('en')))]
  }

  for (const teachingEntry of teachingEntries) {
    const id = getSkillId(teachingEntry.skill)
    const terms = termsFor(teachingEntry.skill)
    if (!id || !terms.length || level(teachingEntry.proficiency) < 0 || seenIds.has(id)
      || terms.some((term) => seenTerms.has(term))) continue

    if (openToAnySkill) {
      eligible.push({ ...teachingEntry, requiredProficiency: null })
      seenIds.add(id)
      terms.forEach((term) => seenTerms.add(term))
      continue
    }

    const requirements = learningEntries.filter((learningEntry) => (
      level(learningEntry.proficiency) >= 0
      && termsFor(learningEntry.skill).some((term) => terms.includes(term))
    ))
    if (!requirements.length) continue
    const requiredProficiency = requirements.reduce((highest, learningEntry) => (
      level(learningEntry.proficiency) > level(highest) ? learningEntry.proficiency : highest
    ), 'BEGINNER')
    if (level(teachingEntry.proficiency) >= level(requiredProficiency)) {
      eligible.push({ ...teachingEntry, requiredProficiency })
      seenIds.add(id)
      terms.forEach((term) => seenTerms.add(term))
    }
  }
  return eligible
}
