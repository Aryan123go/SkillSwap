import { z } from 'zod'

const userSkill = z.object({
  skill: z.string().regex(/^[a-f\d]{24}$/i, 'Choose a skill from the catalogue.'),
  proficiency: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT']),
})

export const updateUserSchema = z.object({
  name: z.string().trim().min(2).max(80),
  bio: z.string().trim().max(500),
  college: z.string().trim().max(120),
  profileImage: z.string().trim().max(2048).optional(),
  skillsToTeach: z.array(userSkill).max(100),
  skillsToLearn: z.array(userSkill).max(100),
  availability: z.object({
    days: z.array(z.enum(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'])).max(7),
    timezone: z.string().trim().max(80),
  }).optional(),
}).strict().refine(
  (value) => new Set(value.skillsToTeach.map((entry) => entry.skill)).size === value.skillsToTeach.length,
  { message: 'A teaching skill cannot be selected more than once.', path: ['skillsToTeach'] },
).refine(
  (value) => new Set(value.skillsToLearn.map((entry) => entry.skill)).size === value.skillsToLearn.length,
  { message: 'A learning skill cannot be selected more than once.', path: ['skillsToLearn'] },
)
