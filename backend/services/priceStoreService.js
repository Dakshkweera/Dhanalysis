// backend/services/priceStoreService.js
// Central price store — eliminates duplicate API calls across users.
//
// IMPORTANT: Never call Alpha Vantage in parallel.
// All API fetches go through getBatchStockPrices which enforces 12s delays.
// On-demand single fetches are intentionally disabled to prevent rate limit abuse.
//
// Flow (cron at 3:35 PM):
//   bulkRefresh(allSymbols) → sequential API fetch → writes MongoDB → warms cache
//
// Flow (dashboard request):
//   getMany(symbols) → cache → MongoDB → returns null if not fetched yet (no API call)
//
// If prices are null on first load (before first cron runs), frontend shows
// "Price unavailable" — acceptable. Cron will populate prices at 3:35 PM.

import StockMetadata from '../models/StockMetadata.js';
import { getBatchStockPrices } from './yahooFinanceService.js';
import { getCached, setCached, bulkSetCached } from './cacheService.js';
import { getISTDate } from '../utils/timezone.js';

// ── Read ──────────────────────────────────────────────────────────────────────

/**
 * getLatestPrice
 * Reads from cache → MongoDB only. NO on-demand API call.
 * Returns null if price not yet fetched (cron hasn't run today).
 */
export const getLatestPrice = async (symbol) => {
  // 1. In-memory cache (sub-millisecond)
  const cached = getCached(symbol);
  if (cached !== null) return cached;

  // 2. MongoDB (survives server restarts)
  const meta = await StockMetadata.findOne({ symbol: symbol.toUpperCase() });
  if (meta?.latestPrice) {
    setCached(symbol, meta.latestPrice);
    return meta.latestPrice;
  }

  // No price available yet — cron hasn't run today
  return null;
};

/**
 * getMany
 * Returns prices for multiple symbols from cache/MongoDB.
 * For missing symbols, fetches them sequentially (with 12s delays) in one batch.
 * This ensures we never make parallel Alpha Vantage calls.
 */
export const getMany = async (symbols) => {
  if (!symbols || symbols.length === 0) return {};

  const priceMap = {};
  const missing = [];

  // Step 1: Check cache + MongoDB for all symbols in parallel (no API calls)
  await Promise.all(
    symbols.map(async (symbol) => {
      const price = await getLatestPrice(symbol);
      if (price !== null) {
        priceMap[symbol] = price;
      } else {
        missing.push(symbol);
      }
    })
  );

  // Step 2: If any symbols missing, fetch them sequentially (respects rate limit)
  if (missing.length > 0) {
    console.log(`⚡ On-demand sequential fetch for ${missing.length} new symbol(s): ${missing.join(', ')}`);
    const fetched = await getBatchStockPrices(missing);

    // Persist and cache newly fetched prices
    const today = getISTDate();
    await Promise.allSettled(
      missing.map(async (symbol) => {
        const price = fetched[symbol];
        priceMap[symbol] = price ?? null;
        if (price) {
          await _upsertPrice(symbol, { price, latestTradingDay: today });
          setCached(symbol, price);
        }
      })
    );
  }

  return priceMap;
};

// ── Write (cron only) ─────────────────────────────────────────────────────────

/**
 * bulkRefresh
 * Fetches all symbols sequentially and writes to MongoDB + cache.
 * Called once per day by the cron after market close.
 */
export const bulkRefresh = async (symbols) => {
  if (!symbols || symbols.length === 0) return {};

  const unique = [...new Set(symbols.map(s => s.toUpperCase()))];
  console.log(`\n🔄 priceStoreService.bulkRefresh: ${unique.length} unique symbol(s)`);

  if (unique.length > 100) {
    console.warn(`⚠️  ${unique.length} unique symbols — approaching Alpha Vantage daily limit.`);
  }

  // Sequential fetch with 12s delays (inside getBatchStockPrices)
  const priceMap = await getBatchStockPrices(unique);

  // Persist to MongoDB
  const today = getISTDate();
  await Promise.allSettled(
    unique.map(async (symbol) => {
      const price = priceMap[symbol];
      if (price !== null && price !== undefined) {
        await _upsertPrice(symbol, { price, latestTradingDay: today });
      }
    })
  );

  // Warm in-memory cache
  bulkSetCached(priceMap);

  const successCount = Object.values(priceMap).filter(p => p !== null).length;
  console.log(`✅ bulkRefresh complete: ${successCount}/${unique.length} prices stored\n`);

  return priceMap;
};

// ── Internal ──────────────────────────────────────────────────────────────────

async function _upsertPrice(symbol, quoteOrPartial) {
  await StockMetadata.findOneAndUpdate(
    { symbol: symbol.toUpperCase() },
    {
      $set: {
        latestPrice:   quoteOrPartial.price,
        previousClose: quoteOrPartial.previousClose ?? null,
        changePercent: quoteOrPartial.changePercent ?? null,
        change:        quoteOrPartial.change ?? null,
        priceDate:     quoteOrPartial.latestTradingDay
          ? new Date(quoteOrPartial.latestTradingDay)
          : getISTDate(),
        lastFetchedAt: new Date(),
      },
    },
    { upsert: true, new: true }
  );
}
