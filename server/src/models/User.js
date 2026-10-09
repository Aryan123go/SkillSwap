import mongoose from 'mongoose'

const userSkillSchema = new mongoose.Schema(
  {
    skill: { type: mongoose.Schema.Types.ObjectId, ref: 'Skill', required: true },
    proficiency: {
      type: String,
      enum: ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'],
      default: 'BEGINNER',
    },
  },
  { _id: false },
)

const availabilitySchema = new mongoose.Schema(
  {
    days: {
      type: [{ type: String, enum: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] }],
      default: [],
    },
    timezone: { type: String, trim: true, maxlength: 80, default: '' },
  },
  { _id: false },
)

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
    },
    passwordHash: { type: String, required: true, select: false },
    profileImage: { type: String, trim: true, maxlength: 2048, default: '' },
    bio: { type: String, trim: true, maxlength: 500, default: '' },
    college: { type: String, trim: true, maxlength: 120, default: '' },
    role: { type: String, enum: ['STUDENT', 'ADMIN'], default: 'STUDENT' },
    skillsToTeach: { type: [userSkillSchema], default: [] },
    skillsToLearn: { type: [userSkillSchema], default: [] },
    availability: { type: availabilitySchema, default: () => ({}) },
  },
  { timestamps: true },
)

userSchema.index({ role: 1, college: 1 })
userSchema.index({ role: 1, 'skillsToTeach.skill': 1 })
userSchema.index({ role: 1, 'skillsToLearn.skill': 1 })

userSchema.set('toJSON', {
  transform(_document, result) {
    delete result.passwordHash
    delete result.__v
    return result
  },
})

export default mongoose.model('User', userSchema)
