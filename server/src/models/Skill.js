import mongoose from 'mongoose'
import { normalizeSkill } from '../utils/normalizeSkill.js'

const skillSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    normalizedName: { type: String, required: true, unique: true },
    aliases: {
      type: [{ type: String, trim: true, maxlength: 80 }],
      default: [],
    },
    category: { type: String, trim: true, maxlength: 60, default: 'Other' },
    description: { type: String, trim: true, maxlength: 300, default: '' },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' },
  },
  { timestamps: true },
)

skillSchema.pre('validate', function normalizeSkillName() {
  if (this.name) this.normalizedName = normalizeSkill(this.name)
  this.aliases = [...new Set((this.aliases ?? []).map(normalizeSkill).filter(Boolean))]
})

export default mongoose.model('Skill', skillSchema)
