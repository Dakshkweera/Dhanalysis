import mongoose from 'mongoose';

const usageLimitSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  month: { type: String, required: true }, // "2025-10"
  questionsAsked: { type: Number, default: 0 },
  questionLimit: { type: Number, default: 10 },
  isPremium: { type: Boolean, default: false },
  lastResetDate: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Compound index for efficient queries
usageLimitSchema.index({ userId: 1, month: 1 });

export default mongoose.model('UsageLimit', usageLimitSchema);
