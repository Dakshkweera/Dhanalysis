import mongoose from 'mongoose';

const marketBenchmarkSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true,
    unique: true  // One entry per date
  },
  nifty50: {
    type: Number,
    required: true
  },
  nifty50Change: {
    type: Number,  // Daily % change
    default: 0
  },
  nifty50ChangeValue: {
    type: Number,  // Daily absolute change
    default: 0
  }
}, {
  timestamps: true
});

// Index for faster date queries
marketBenchmarkSchema.index({ date: -1 });

export default mongoose.model('MarketBenchmark', marketBenchmarkSchema);
