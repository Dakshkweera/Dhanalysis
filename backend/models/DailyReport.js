// backend/models/DailyReport.js

import mongoose from 'mongoose';

const stockPerformanceSchema = new mongoose.Schema({
  symbol: { type: String, required: true },
  quantity: { type: Number, required: true },
  buyPrice: { type: Number, default: 0 },      // avg cost basis — enables per-stock ROI from snapshot alone
  currentPrice: { type: Number, required: true },
  previousPrice: { type: Number, default: null },
  value: { type: Number, required: true },
  dayChange: { type: Number, default: 0 },
  dayChangeAmount: { type: Number, default: 0 },
  weight: { type: Number, default: 0 }
}, { _id: false });

const benchmarkComparisonSchema = new mongoose.Schema({
  nifty50Value: { type: Number, default: null },
  niftyDailyReturn: { type: Number, default: 0 },
  beatNifty: { type: Boolean, default: false },
  outperformance: { type: Number, default: 0 }
}, { _id: false });

const dailyReportSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  date: {
    type: Date,        // ✅ CHANGED from String to Date
    required: true,
    index: true
  },
  
  // ✅ Existing fields
  totalInvested: { type: Number, required: true },
  portfolioValue: { type: Number, required: true },
  profitLoss: { type: Number, required: true },
  roi: { type: Number, required: true },
  cagr: { type: Number, default: 0 },
  xirr: { type: Number, default: null },
  absoluteReturn: { type: Number, default: 0 },
  totalHoldings: { type: Number, default: 0 },
  
  // ✅ NEW: Daily changes
  dailyReturn: { type: Number, default: 0 },
  dailyProfitLoss: { type: Number, default: 0 },
  
  // ✅ NEW: Drawdown tracking
  peakReturn: { type: Number, default: 0 },
  currentDrawdown: { type: Number, default: 0 },
  
  // ✅ NEW: Enhanced benchmark comparison
  benchmarkComparison: {
    type: benchmarkComparisonSchema,
    default: () => ({})
  },
  
  // ✅ NEW: Per-stock performance
  stockPerformance: {
    type: [stockPerformanceSchema],
    default: []
  }
  
}, {
  timestamps: true
});

// Compound index for efficient queries
dailyReportSchema.index({ userId: 1, date: -1 });

export default mongoose.model('DailyReport', dailyReportSchema);
