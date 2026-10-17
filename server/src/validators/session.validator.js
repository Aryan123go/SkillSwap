import { z } from 'zod'

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Use a valid exchange request or session ID.')
const timestamp = z.iso.datetime({ offset: true })

function validateSchedule(value, context) {
  const start = new Date(value.startAt)
  const end = new Date(value.endAt)
  if (end <= start) {
    context.addIssue({ code: 'custom', message: 'The session end must be after its start.', path: ['endAt'] })
    return
  }
  const duration = end.getTime() - start.getTime()
  if (duration < 15 * 60_000 || duration > 4 * 60 * 60_000) {
    context.addIssue({ code: 'custom', message: 'Sessions must last between 15 minutes and 4 hours.', path: ['endAt'] })
  }
}

export const createSessionSchema = z.object({
  exchangeRequest: objectId,
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional().default(''),
  startAt: timestamp,
  endAt: timestamp,
}).strict().superRefine(validateSchedule)

export const rescheduleSessionSchema = z.object({
  startAt: timestamp,
  endAt: timestamp,
}).strict().superRefine(validateSchedule)

export const sessionListQuerySchema = z.object({
  status: z.enum(['PROPOSED', 'CONFIRMED', 'DECLINED', 'CANCELLED', 'COMPLETED']).optional(),
  period: z.enum(['upcoming', 'past']).optional(),
  page: z.string().regex(/^[1-9]\d*$/).optional().default('1'),
  limit: z.string().regex(/^[1-9]\d*$/).optional().default('10'),
}).strict().superRefine((value, context) => {
  const page = Number(value.page)
  const limit = Number(value.limit)
  if (!Number.isSafeInteger(page) || !Number.isSafeInteger((page - 1) * limit)) {
    context.addIssue({ code: 'custom', message: 'Page number is too large.', path: ['page'] })
  }
  if (Number(limit) > 50) {
    context.addIssue({ code: 'custom', message: 'Page size cannot exceed 50.', path: ['limit'] })
  }
})
