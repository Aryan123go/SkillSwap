import mongoose from 'mongoose'

const messageSchema = new mongoose.Schema({
  conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true, trim: true, minlength: 1, maxlength: 2000 },
  clientMessageId: { type: String, trim: true, maxlength: 100, default: null },
}, { timestamps: true })

messageSchema.index({ conversation: 1, createdAt: -1, _id: -1 })
messageSchema.index(
  { conversation: 1, sender: 1, clientMessageId: 1 },
  { unique: true, partialFilterExpression: { clientMessageId: { $type: 'string' } } },
)

export default mongoose.model('Message', messageSchema)
