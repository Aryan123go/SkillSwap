import mongoose from 'mongoose'

const reviewSchema = new mongoose.Schema({
  session: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', required: true },
  reviewer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reviewee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  rating: { type: Number, required: true, min: 1, max: 5, validate: Number.isInteger },
  comment: { type: String, trim: true, maxlength: 500, default: '' },
}, { timestamps: true })

// Each participant can leave at most one review for the other participant per session.
reviewSchema.index({ session: 1, reviewer: 1 }, { unique: true })
reviewSchema.index({ reviewee: 1, createdAt: -1 })

reviewSchema.set('toJSON', {
  transform(_document, result) {
    delete result.__v
    return result
  },
})

export default mongoose.model('Review', reviewSchema)
