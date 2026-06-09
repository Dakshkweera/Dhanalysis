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

    // Recent daily prices (written by backfillService after TIME_SERIES_DAILY call)
    // { '2026-06-05': 1291.50, '2026-06-04': 1285.00, ... }
    // Cached for the day — any user adding this symbol reuses it, no duplicate API calls
    recentPrices:          { type: mongoose.Schema.Types.Mixed, default: null },
    recentPricesFetchedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.model('StockMetadata', stockMetadataSchema);
