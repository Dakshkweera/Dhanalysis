// backend/services/alphaVantageService.js
// The only file that talks to Alpha Vantage API.
// All other services call this file — never call Alpha Vantage directly elsewhere.
//
// Why key rotation?
//   Alpha Vantage free tier = 25 requests/day per API key.
//   We have 5 keys → 125 requests/day.
//   When one key hits its limit, we automatically switch to the next.
//
// Why sequential with 12-second delays?
//   Alpha Vantage also limits to 5 requests/minute.
//   12 seconds between calls = 5 calls/minute maximum — stays within limit.

import axios from 'axios';
import config from '../config/env.js';
import {
  ALPHA_VANTAGE_BASE_URL,
  ALPHA_VANTAGE_DELAY_MS,
  MAX_REQUESTS_PER_KEY,
} from '../config/constants.js';

// ── Key rotation state ────────────────────────────────────────────────────────
// These live at module level — they persist for the whole server lifetime.
// currentKeyIndex tracks which key we're currently using.
// requestCount tracks how many calls we've made with the current key.

let currentKeyIndex = 0;
let requestCount = 0;

/**
 * getApiKey
 * ---------
 * Returns the current active API key.
 * Rotates to next key when MAX_REQUESTS_PER_KEY (24) is reached.
 * Round-robin: last key wraps back to key 1.
 */
const getApiKey = () => {
  const keys = config.ALPHA_VANTAGE_KEYS;
  if (requestCount >= MAX_REQUESTS_PER_KEY) {
    currentKeyIndex = (currentKeyIndex + 1) % keys.length;
    requestCount = 0;
    console.log(`🔄 Rotated to Alpha Vantage key ${currentKeyIndex + 1} of ${keys.length}`);
  }
  requestCount++;
  return keys[currentKeyIndex];
};

/**
 * rotateOnRateLimit
 * -----------------
 * Called when a key returns a rate limit signal.
 * Immediately moves to the next key so the next call uses a fresh key.
 * Resets request count so the new key gets a full 24-call quota.
 */
const rotateOnRateLimit = () => {
  const keys = config.ALPHA_VANTAGE_KEYS;
  const oldIndex = currentKeyIndex;
  currentKeyIndex = (currentKeyIndex + 1) % keys.length;
  requestCount = 0;
  console.log(`🔄 Rate limit on key ${oldIndex + 1} → rotating to key ${currentKeyIndex + 1} of ${keys.length}`);
};

// ── BSE symbol overrides ──────────────────────────────────────────────────────
// Some stocks have different ticker names on BSE vs NSE.
// If Alpha Vantage returns NO_DATA for a .BSE symbol, add the correct BSE ticker here.
const BSE_OVERRIDES = {
  'TATAMOTORS': 'TATAMTRDVR.BSE', // Tata Motors DVR variant on BSE
  'M&M':        'M%26M.BSE',       // URL-encoded ampersand
};

// ── Symbol conversion ─────────────────────────────────────────────────────────

/**
 * toBSESymbol
 * -----------
 * Converts our internal symbol format to Alpha Vantage's expected format.
 *
 * Why do we need this?
 *   We store symbols as "RELIANCE.NS" in MongoDB (NSE format from Yahoo Finance era).
 *   Alpha Vantage requires "RELIANCE.BSE" (Bombay Stock Exchange format).
 *   Rather than migrating all data, we convert at the API boundary.
 *
 * Conversions:
 *   RELIANCE.NS  → RELIANCE.BSE  (NSE suffix → BSE suffix)
 *   RELIANCE.BO  → RELIANCE.BSE  (old BSE suffix → new)
 *   RELIANCE.BSE → RELIANCE.BSE  (already correct)
 *   RELIANCE     → RELIANCE.BSE  (no suffix → add BSE)
 */
export const toBSESymbol = (symbol) => {
  if (!symbol) return null;
  const base = symbol.replace(/\.(NS|BO|BSE)$/i, '').toUpperCase().trim();
  // Check if this symbol has a known BSE override
  if (BSE_OVERRIDES[base]) return BSE_OVERRIDES[base];
  return `${base}.BSE`;
};

// ── Delay helper ──────────────────────────────────────────────────────────────

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ── Core fetch ────────────────────────────────────────────────────────────────

/**
 * Fetches a single GLOBAL_QUOTE from Alpha Vantage.
 * @param {string} bseSymbol - e.g. "RELIANCE.BSE"
 * @returns {{ price, previousClose, changePercent, change, volume, latestTradingDay }}
 */
export const fetchQuote = async (bseSymbol) => {
  const apiKey = getApiKey();
  const url = `${ALPHA_VANTAGE_BASE_URL}?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(bseSymbol)}&apikey=${apiKey}`;

  const { data } = await axios.get(url, { timeout: 15000 });

  // Rate limit or API limit signal — rotate key immediately for next call
  if (data.Note || data.Information) {
    const msg = data.Note || data.Information;
    console.warn(`⚠️  Alpha Vantage rate limit signal (key ${currentKeyIndex + 1}): ${msg.slice(0, 80)}`);
    rotateOnRateLimit();
    throw new Error('RATE_LIMIT');
  }

  const quote = data['Global Quote'];
  if (!quote || !quote['05. price'] || quote['05. price'] === '') {
    throw new Error(`NO_DATA: ${bseSymbol}`);
  }

  return {
    price:            parseFloat(quote['05. price']),
    previousClose:    parseFloat(quote['08. previous close'] || '0'),
    change:           parseFloat(quote['09. change'] || '0'),
    changePercent:    parseFloat((quote['10. change percent'] || '0%').replace('%', '')),
    volume:           parseInt(quote['06. volume'] || '0', 10),
    latestTradingDay: quote['07. latest trading day'],
  };
};

// ── Batch fetch (sequential with delay) ──────────────────────────────────────

/**
 * Fetches prices for multiple symbols.
 * Sequential with ALPHA_VANTAGE_DELAY_MS gap to respect 5 req/min limit.
 * Symbols are stored as .NS in DB — converted to .BSE here.
 *
 * @param {string[]} symbols - Array of symbols in any format (e.g. ["RELIANCE.NS"])
 * @returns {Object} priceMap - { "RELIANCE.NS": 2456.70, "INFY.NS": 1197.00, ... }
 */
export const getBatchStockPrices = async (symbols) => {
  const priceMap = {};
  if (!symbols || symbols.length === 0) return priceMap;

  // Dedupe
  const unique = [...new Set(symbols)];
  console.log(`\n📊 Alpha Vantage: fetching ${unique.length} symbol(s)...`);

  for (let i = 0; i < unique.length; i++) {
    const symbol = unique[i];
    const bseSymbol = toBSESymbol(symbol);

    try {
      const quote = await fetchQuote(bseSymbol);
      priceMap[symbol] = quote.price;
      console.log(`  ✅ ${symbol} → ₹${quote.price} (via ${bseSymbol})`);
    } catch (err) {
      console.error(`  ❌ ${symbol} (${bseSymbol}): ${err.message}`);
      priceMap[symbol] = null;
    }

    // Delay between calls — skip after last symbol
    if (i < unique.length - 1) {
      await delay(ALPHA_VANTAGE_DELAY_MS);
    }
  }

  const successCount = Object.values(priceMap).filter((p) => p !== null).length;
  console.log(`📊 Alpha Vantage: ${successCount}/${unique.length} prices fetched\n`);

  return priceMap;
};

/**
 * Fetches a single stock's full quote data (price + change info).
 * @param {string} symbol - any format
 * @returns quote object or null on failure
 */
export const getStockQuote = async (symbol) => {
  const bseSymbol = toBSESymbol(symbol);
  try {
    return await fetchQuote(bseSymbol);
  } catch (err) {
    console.error(`getStockQuote failed for ${symbol}: ${err.message}`);
    return null;
  }
};

/**
 * fetchDailyTimeSeries
 * --------------------
 * Fetches TIME_SERIES_DAILY for a BSE symbol.
 * Returns the last `limit` trading days as { 'YYYY-MM-DD': closingPrice }.
 *
 * Why this instead of GLOBAL_QUOTE?
 *   GLOBAL_QUOTE only returns today's price.
 *   TIME_SERIES_DAILY returns up to 100 days of OHLCV data in one call.
 *   We use this to backfill the last 7 days when a new investment is added.
 *
 * @param {string} bseSymbol — e.g. 'RELIANCE.BSE'
 * @param {number} limit     — max days to return (default 15, buffer for weekends)
 * @returns {Object}         — { '2026-06-05': 1291.50, '2026-06-04': 1285.00, ... }
 */
export const fetchDailyTimeSeries = async (bseSymbol, limit = 15, full = false) => {
  const apiKey    = getApiKey();
  const outputsize = full ? 'full' : 'compact';
  const url = `${ALPHA_VANTAGE_BASE_URL}?function=TIME_SERIES_DAILY&symbol=${encodeURIComponent(bseSymbol)}&outputsize=${outputsize}&apikey=${apiKey}`;

  const { data } = await axios.get(url, { timeout: 15000 });

  // Rate limit or API limit signal — rotate key immediately for next call
  if (data.Note || data.Information) {
    const msg = data.Note || data.Information;
    console.warn(`⚠️  Alpha Vantage rate limit (key ${currentKeyIndex + 1}): ${msg.slice(0, 80)}`);
    rotateOnRateLimit();
    throw new Error('RATE_LIMIT');
  }

  const timeSeries = data['Time Series (Daily)'];
  if (!timeSeries) {
    console.error(`No time series in response for ${bseSymbol}:`, JSON.stringify(data).slice(0, 200));
    throw new Error(`NO_DATA: ${bseSymbol}`);
  }

  // Sort dates descending, take `limit` days (or all if full=true)
  const dates = Object.keys(timeSeries).sort().reverse();
  const result = {};
  const max    = full ? dates.length : Math.min(limit, dates.length);

  for (let i = 0; i < max; i++) {
    const date  = dates[i];
    const close = parseFloat(timeSeries[date]['4. close']);
    if (!isNaN(close) && close > 0) {
      result[date] = close;
    }
  }

  const count = Object.keys(result).length;
  if (count === 0) throw new Error(`NO_VALID_PRICES: ${bseSymbol}`);

  console.log(`  📈 TIME_SERIES_DAILY ${bseSymbol}: ${count} days (latest: ${Object.keys(result)[0]})`);
  return result;
};
