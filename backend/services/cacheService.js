// backend/services/cacheService.js
// In-memory price cache — the fastest layer in our 3-tier price lookup.
//
// Why do we need a cache at all?
//   Every time a user opens the dashboard, it calls /portfolio/summary
//   which needs current stock prices. Without cache, that hits Alpha Vantage
//   every time — burning through our 25 req/day quota instantly.
//   With cache, prices are fetched once (by the cron) and served from memory.
//
// The 3-tier lookup (fastest → slowest):
//   Tier 1: In-memory Map (this file)    — sub-millisecond, resets on restart
//   Tier 2: MongoDB StockMetadata        — ~5ms, survives restarts
//   Tier 3: Alpha Vantage API call       — ~2 seconds, counts toward daily quota
//
// TTL (Time To Live) = 30 minutes.
//   After 30 mins, the cached price expires and Tier 2/3 are used instead.
//   This means dashboard prices are at most 30 mins stale — acceptable for EOD data.
//
// Single module-level Map = shared across ALL requests in the same Node.js process.
// Resets on Render cold-start — that's fine because StockMetadata is the durable backup.

import { PRICE_CACHE_TTL_MS } from '../config/constants.js';

const cache = new Map();

/**
 * Get a cached price. Returns null if missing or expired.
 * @param {string} symbol
 * @returns {number|null}
 */
export const getCached = (symbol) => {
  const entry = cache.get(symbol);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(symbol);
    return null;
  }
  return entry.price;
};

/**
 * Store a price in the cache.
 * @param {string} symbol
 * @param {number} price
 * @param {number} [ttlMs] - optional override for TTL
 */
export const setCached = (symbol, price, ttlMs = PRICE_CACHE_TTL_MS) => {
  if (price === null || price === undefined) return;
  cache.set(symbol, {
    price,
    expiresAt: Date.now() + ttlMs,
  });
};

/**
 * Bulk set prices from a priceMap object.
 * @param {Object} priceMap - { symbol: price }
 */
export const bulkSetCached = (priceMap) => {
  Object.entries(priceMap).forEach(([symbol, price]) => {
    setCached(symbol, price);
  });
};

/**
 * Get cache stats for debugging.
 */
export const getCacheStats = () => ({
  size: cache.size,
  symbols: [...cache.keys()],
});

/**
 * Clear entire cache (useful for testing).
 */
export const clearCache = () => cache.clear();
