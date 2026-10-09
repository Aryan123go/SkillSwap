import mongoose from 'mongoose'

const exchangeRequestSchema = new mongoose.Schema(
  {
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    requestedSkill: { type: mongoose.Schema.Types.ObjectId, ref: 'Skill', required: true },
    offeredSkill: { type: mongoose.Schema.Types.ObjectId, ref: 'Skill', default: null },
    message: { type: String, trim: true, maxlength: 500, default: '' },
    status: {
      type: String,
      enum: ['PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED'],
      default: 'PENDING',
      required: true,
    },
  },
  { timestamps: true },
)

exchangeRequestSchema.index(
  { sender: 1, recipient: 1, requestedSkill: 1 },
  { unique: true, partialFilterExpression: { status: 'PENDING' } },
)
exchangeRequestSchema.index({ sender: 1, createdAt: -1 })
exchangeRequestSchema.index({ recipient: 1, createdAt: -1 })

export default mongoose.model('ExchangeRequest', exchangeRequestSchema)
