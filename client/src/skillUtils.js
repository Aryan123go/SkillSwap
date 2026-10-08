export function getSkillId(skill) {
  return typeof skill === 'string' ? skill : skill?._id ?? skill?.id
}

export function capitalize(value) {
  return value.charAt(0) + value.slice(1).toLowerCase()
}

export const PROFICIENCIES = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT']
