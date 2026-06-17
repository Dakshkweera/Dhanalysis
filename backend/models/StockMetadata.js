// backend/models/StockMetadata.js
// Central store for stock metadata AND latest daily price.
// The cron fetches all unique symbols once and writes here.
// All controllers read prices from here — zero duplicate API calls.

import mongoose from 'mongoose';

const stockMetadataSchema = new mongoose.Schema(
  {
    symbol: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },

    // Static metadata (sector, industry)
    name:     { type: String, default: '' },
    sector:   { type: String, default: 'Others' },
    industry: { type: String, default: 'N/A' },

    // Latest price data (written by cron / priceStoreService)
    latestPrice:   { type: Number, default: null },
    previousClose: { type: Number, default: null },
    changePercent: { type: Number, default: null },
    change:        { type: Number, default: null },
    priceDate:     { type: Date,   default: null },   // Date the price was fetched for
    lastFetchedAt: { type: Date,   default: null },   // Wall-clock time of last fetch

    // Historical daily prices — shared across all users, grows automatically
    // Backfill writes full range (buyDate → today). Cron appends today's price daily.
    // { '2026-03-01': 1250.50, '2026-03-03': 1265.00, ... }
    priceHistory:          { type: mongoose.Schema.Types.Mixed, default: {} },
    priceHistoryUpdatedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.model('StockMetadata', stockMetadataSchema);
