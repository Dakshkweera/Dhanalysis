import mongoose from 'mongoose';

const chatHistorySchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  question: {
    type: String,
    required: true
  },
  answer: {
    type: String,
    required: true
  },
  sources: [{
    type: String
  }],
  tokensUsed: {
    type: Number,
    default: 0
  },
  month: {
    type: String, // "2025-10" for easy filtering
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for efficient queries
chatHistorySchema.index({ userId: 1, month: 1 });

export default mongoose.model('ChatHistory', chatHistorySchema);
