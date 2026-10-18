import { z } from 'zod'

export const createMessageSchema = z.object({
  content: z.string().trim().min(1, 'Write a message before sending.').max(2000, 'Messages must be 2,000 characters or fewer.'),
  clientMessageId: z.string().trim().min(1).max(100).optional(),
}).strict()
