import { z } from 'zod'

export const createReviewSchema = z.object({
  sessionId: z.string().regex(/^[a-f\d]{24}$/i, 'Use a valid session ID.'),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(500).optional().default(''),
}).strict()
