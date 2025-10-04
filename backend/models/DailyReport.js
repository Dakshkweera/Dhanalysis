import mongoose from "mongoose";

const dailyReportSchema = new mongoose.Schema({
  userId: { 
    type: String, 
    required: true,
    index: true
  },
  date: { 
    type: Date, 
    required: true 
  },
  
  // Portfolio metrics
  totalInvested: {
    type: Number,
    required: true,
    min: 0
  },
  portfolioValue: { 
    type: Number, 
    required: true,
    min: 0
  },
  profitLoss: { 
    type: Number, 
    required: true 
  },
  roi: { 
    type: Number, 
    required: true 
  },
  cagr: {
    type: Number,
    required: true
  },
  xirr: {              // ← ADD THIS FIELD
  type: Number,
  default: null
  },
  absoluteReturn: {
    type: Number,
    required: true
  },
  
  // Day-over-day change (UPDATED)
  dailyChange: {
    portfolioValue: Number,        // Total portfolio value change
    percentage: Number,            // Total percentage change
    newCapitalAdded: Number,       // New money invested (or withdrawn if negative)
    marketChange: Number,          // Actual market performance
    marketChangePercentage: Number // Market performance percentage
  },
  
  // Top performers snapshot
  topPerformers: {
    best: {
      symbol: String,
      roi: Number,
      profitLoss: Number
    },
    worst: {
      symbol: String,
      roi: Number,
      profitLoss: Number
    }
  },
  
  // Holdings count
  totalHoldings: {
    type: Number,
    required: true,
    min: 0
  },
  
  // Benchmark comparison (for future use)
 benchmarkComparison: {
  nifty50Value: {
    type: Number,
    default: null
  },
  nifty50Change: {
    type: Number,
    default: null
  },
  niftyReturnSinceStart: {
    type: Number,
    default: null
  },
  portfolioReturnSinceStart: {
    type: Number,
    default: null
  },
  outperformance: {
    type: Number,
    default: null
  },
  outperformanceXIRR: {
    type: Number,
    default: null
  }
}

}, { timestamps: true });

// Compound unique index: one report per user per day
dailyReportSchema.index({ userId: 1, date: 1 }, { unique: true });

export default mongoose.model("DailyReport", dailyReportSchema);
