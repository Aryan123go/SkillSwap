import { z } from 'zod'

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Use a valid student and skill selection.')

export const createExchangeRequestSchema = z.object({
  recipient: objectId,
  requestedSkill: objectId,
  offeredSkill: objectId.optional(),
  message: z.string().trim().max(500).optional().default(''),
}).strict()

export const requestListQuerySchema = z.object({
  page: z.string().regex(/^[1-9]\d*$/).optional().default('1'),
  limit: z.string().regex(/^[1-9]\d*$/).optional().default('10'),
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
