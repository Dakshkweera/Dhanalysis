
import mongoose from "mongoose";

const investmentSchema = new mongoose.Schema({
  userId: { 
    type: String, 
    required: true,
    index: true  // Index for querying user's investments
  },
  symbol: { 
    type: String, 
    required: true,
    uppercase: true,  // Standardize ticker symbols
    trim: true
  },
  type: { 
    type: String, 
    enum: ["Stock", "ETF", "Mutual Fund"], 
    required: true 
  },
  quantity: { 
    type: Number, 
    required: true,
    min: 0  // Prevent negative quantities
  },
  buyPrice: { 
    type: Number, 
    required: true,
    min: 0  // Prevent negative prices
  },
  buyDate: { 
    type: Date, 
    required: true 
  },
}, { timestamps: true });

// Compound index for efficient user + symbol queries
investmentSchema.index({ userId: 1, symbol: 1 });

export default mongoose.model("Investment", investmentSchema);
