import mongoose from 'mongoose'

const conversationSchema = new mongoose.Schema({
  exchangeRequest: { type: mongoose.Schema.Types.ObjectId, ref: 'ExchangeRequest', required: true, unique: true },
  participants: {
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
    validate: {
      validator(value) {
        return Array.isArray(value) && value.length === 2 && value[0]?.toString() !== value[1]?.toString()
      },
      message: 'A conversation must have exactly two distinct participants.',
    },
  },
  lastMessageAt: { type: Date, default: null },
  lastMessageText: { type: String, maxlength: 500, default: '' },
  lastMessageSender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  readBy: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    lastReadAt: { type: Date, required: true },
  }],
}, { timestamps: true })

conversationSchema.index({ participants: 1, lastMessageAt: -1, updatedAt: -1 })

export default mongoose.model('Conversation', conversationSchema)
