import { z } from 'zod'

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Choose a skill from the catalogue.')

export const discoveryQuerySchema = z.object({
  q: z.string().trim().max(100).optional().default(''),
  teachingSkill: objectId.optional(),
  learningSkill: objectId.optional(),
  proficiency: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT']).optional(),
  college: z.string().trim().max(120).optional().default(''),
  page: z.string().regex(/^[1-9]\d*$/).optional().default('1'),
  limit: z.string().regex(/^[1-9]\d*$/).optional().default('12'),
}).strict().superRefine((value, context) => {
  const page = Number(value.page)
  const limit = Number(value.limit)
  if (!Number.isSafeInteger(page) || !Number.isSafeInteger((page - 1) * limit)) {
    context.addIssue({ code: 'custom', message: 'Page number is too large.', path: ['page'] })
  }
  if (Number(value.limit) > 50) {
    context.addIssue({ code: 'custom', message: 'Page size cannot exceed 50.', path: ['limit'] })
  }
})

export function parseDiscoveryQuery(query) {
  const parsed = discoveryQuerySchema.safeParse(query)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid discovery filters.' }
  }
  return { data: { ...parsed.data, page: Number(parsed.data.page), limit: Number(parsed.data.limit) } }
}
