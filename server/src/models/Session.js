import mongoose from 'mongoose'

const sessionSchema = new mongoose.Schema(
  {
    exchangeRequest: { type: mongoose.Schema.Types.ObjectId, ref: 'ExchangeRequest', required: true },
    organizer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    participants: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
      required: true,
      validate: {
        validator(participants) {
          return participants.length === 2
            && new Set(participants.map((id) => id.toString())).size === 2
            && Boolean(this.organizer)
            && participants.some((id) => id.toString() === this.organizer.toString())
        },
        message: 'A session must have exactly two distinct participants and its organizer must be one of them.',
      },
    },
    title: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 500, default: '' },
    startAt: { type: Date, required: true },
    endAt: {
      type: Date,
      required: true,
      validate: [
        {
          validator(endAt) {
            return !this.startAt || endAt > this.startAt
          },
          message: 'The session end must be after its start.',
        },
        {
          validator(endAt) {
            if (!this.startAt || !(endAt > this.startAt)) return true
            const duration = endAt.getTime() - this.startAt.getTime()
            return duration >= 15 * 60_000 && duration <= 4 * 60 * 60_000
          },
          message: 'Sessions must last between 15 minutes and 4 hours.',
        },
      ],
    },
    status: {
      type: String,
      enum: ['PROPOSED', 'CONFIRMED', 'DECLINED', 'CANCELLED', 'COMPLETED'],
      default: 'PROPOSED',
      required: true,
    },
    revision: { type: Number, default: 0, select: false },
  },
  { timestamps: true },
)

sessionSchema.index({ participants: 1, startAt: 1 })
sessionSchema.index({ exchangeRequest: 1, createdAt: -1 })

export default mongoose.model('Session', sessionSchema)
