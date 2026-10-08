import mongoose from 'mongoose'
import Skill from '../models/Skill.js'
import User from '../models/User.js'
import { HttpError } from '../utils/HttpError.js'
import { toSafeUser } from '../services/auth.service.js'

async function validateSkillReferences(entries) {
  const ids = [...new Set(entries.map((entry) => entry.skill))]
  const count = await Skill.countDocuments({ _id: { $in: ids }, status: 'ACTIVE' })
  if (count !== ids.length) {
    throw new HttpError(400, 'Select skills from the available catalogue.', 'INVALID_SKILL')
  }
  return entries.map((entry) => ({
    skill: new mongoose.Types.ObjectId(entry.skill),
    proficiency: entry.proficiency,
  }))
}

export async function getMyProfile(request, response) {
  const user = await User.findById(request.user._id)
    .populate('skillsToTeach.skill', 'name category aliases')
    .populate('skillsToLearn.skill', 'name category aliases')
  response.json({ success: true, data: { user: toSafeUser(user) } })
}

export async function updateMyProfile(request, response) {
  const input = request.validatedBody
  const [skillsToTeach, skillsToLearn] = await Promise.all([
    validateSkillReferences(input.skillsToTeach),
    validateSkillReferences(input.skillsToLearn),
  ])
  const user = await User.findByIdAndUpdate(
    request.user._id,
    {
      $set: {
        name: input.name,
        bio: input.bio,
        college: input.college,
        skillsToTeach,
        skillsToLearn,
        ...(input.profileImage === undefined ? {} : { profileImage: input.profileImage }),
        ...(input.availability === undefined ? {} : { availability: input.availability }),
      },
    },
    { new: true, runValidators: true },
  )
    .populate('skillsToTeach.skill', 'name category aliases')
    .populate('skillsToLearn.skill', 'name category aliases')
  response.json({ success: true, data: { user: toSafeUser(user) } })
}

export async function getPublicProfile(request, response) {
  if (!mongoose.isValidObjectId(request.params.id)) {
    throw new HttpError(404, 'This profile could not be found.', 'USER_NOT_FOUND')
  }
  const user = await User.findById(request.params.id)
    .select('name profileImage bio college skillsToTeach skillsToLearn createdAt')
    .populate('skillsToTeach.skill', 'name category aliases')
    .populate('skillsToLearn.skill', 'name category aliases')
  if (!user) throw new HttpError(404, 'This profile could not be found.', 'USER_NOT_FOUND')
  response.json({ success: true, data: { user: user.toJSON() } })
}
