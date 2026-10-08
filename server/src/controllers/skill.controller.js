import { listSkills } from '../services/skill.service.js'

export async function getSkills(_request, response) {
  const skills = await listSkills()
  response.json({ success: true, data: { skills } })
}
