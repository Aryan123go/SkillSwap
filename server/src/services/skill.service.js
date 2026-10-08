import Skill from '../models/Skill.js'
import { initialSkills } from '../data/initialSkills.js'

export async function initializeSkillCatalogue() {
  await Skill.bulkWrite(
    initialSkills.map((skill) => ({
      updateOne: {
        filter: { normalizedName: skill.name.trim().toLocaleLowerCase('en') },
        update: { $setOnInsert: skill },
        upsert: true,
      },
    })),
    { ordered: false },
  )
}

export async function listSkills() {
  return Skill.find({ status: 'ACTIVE' }).sort({ category: 1, name: 1 }).lean()
}
