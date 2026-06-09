// backend/services/yahooFinanceService.js
// Direct axios calls to Yahoo Finance — same URL the browser uses.
// Short ranges (5d-7d) work without auth. Long ranges (2y+) need crumb.
// We only use short ranges so no session management needed.

import axios from 'axios';
import StockMetadata from '../models/StockMetadata.js';

const delay = ms => new Promise(r => setTimeout(r, ms));

// Browser-like headers — Yahoo blocks bot-like requests without these
const HEADERS = {
  'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Accept':          'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Referer':         'https://finance.yahoo.com/',
};

// ── Core fetch ────────────────────────────────────────────────────────────────

const fetchChart = async (symbol, params = {}) => {
  const hosts = [
    'https://query1.finance.yahoo.com',
    'https://query2.finance.yahoo.com',
  ];

  let lastError;
  for (const host of hosts) {
    try {
      const { data } = await axios.get(
        `${host}/v8/finance/chart/${encodeURIComponent(symbol)}`,
        { headers: HEADERS, timeout: 15000, params }
      );

      const result = data?.chart?.result?.[0];
      if (!result) throw new Error(data?.chart?.error?.description || `NO_DATA: ${symbol}`);
      return result;
    } catch (err) {
      lastError = err;
      if (err.response?.status === 404 || err.response?.status === 429) {
        await delay(500);
        continue;
      }
      throw err;
    }
  }
  throw lastError;
};

// ── Cache ─────────────────────────────────────────────────────────────────────

const saveToCache = async (symbol, prices) => {
  try {
    await StockMetadata.findOneAndUpdate(
      { symbol: symbol.toUpperCase() },
      { $set: { recentPrices: prices, recentPricesFetchedAt: new Date() } },
      { upsert: true }
    );
  } catch (err) {
    console.error(`saveToCache failed for ${symbol}: ${err.message}`);
  }
};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * getPriceOnDate — closing price for a symbol on a specific date.
 * Fetches only 7 days around the buy date — short range, no auth needed.
 */
export const getPriceOnDate = async (symbol, date) => {
  const dateStr = new Date(date).toISOString().split('T')[0];

  // period1 = 7 days before buy date to cover weekends/holidays
  const from    = new Date(date);
  from.setDate(from.getDate() - 7);
  const period1 = Math.floor(from.getTime() / 1000);
  const period2 = Math.floor(new Date(date).getTime() / 1000) + 86400; // +1 day buffer

  try {
    const result     = await fetchChart(symbol, { interval: '1d', period1, period2 });
    const timestamps = result.timestamp || [];
    const closes     = result.indicators?.quote?.[0]?.close || [];

    const prices = {};
    for (let i = 0; i < timestamps.length; i++) {
      const close = closes[i];
      if (close && !isNaN(close)) {
        const d        = new Date(timestamps[i] * 1000).toISOString().split('T')[0];
        prices[d]      = parseFloat(close.toFixed(2));
      }
    }

    await saveToCache(symbol, prices);

    // Exact date
    if (prices[dateStr]) return prices[dateStr];

    // Nearest previous trading day
    const nearest = Object.keys(prices).sort().reverse().find(d => d <= dateStr);
    if (nearest) {
      console.log(`  📅 ${dateStr} not trading day — using ${nearest} (₹${prices[nearest]})`);
      return prices[nearest];
    }

    throw { code: 'NOT_TRADING_DAY', date: dateStr };
  } catch (err) {
    if (err.code === 'NOT_TRADING_DAY') throw err;
    console.error(`getPriceOnDate failed for ${symbol} on ${date}: ${err.message}`);
    return null;
  }
};

/**
 * getStockQuote — current price for a single symbol.
 */
export const getStockQuote = async (symbol) => {
  try {
    const result        = await fetchChart(symbol, { interval: '1d', range: '1d' });
    const meta          = result.meta;
    const price         = meta.regularMarketPrice || meta.previousClose;
    if (!price) return null;

    const previousClose = meta.previousClose || price;
    return {
      price:         parseFloat(price.toFixed(2)),
      previousClose: parseFloat(previousClose.toFixed(2)),
      change:        parseFloat((price - previousClose).toFixed(2)),
      changePercent: previousClose > 0
        ? parseFloat(((price - previousClose) / previousClose * 100).toFixed(2))
        : 0,
    };
  } catch (err) {
    console.error(`getStockQuote failed for ${symbol}: ${err.message}`);
    return null;
  }
};

/**
 * getBatchStockPrices — current prices for multiple symbols.
 */
export const getBatchStockPrices = async (symbols) => {
  const priceMap = {};
  if (!symbols || symbols.length === 0) return priceMap;

  const unique = [...new Set(symbols)];
  console.log(`\n📊 Yahoo Finance: fetching ${unique.length} symbol(s)...`);

  for (let i = 0; i < unique.length; i++) {
    const symbol = unique[i];
    try {
      const quote = await getStockQuote(symbol);
      if (quote?.price) {
        priceMap[symbol] = quote.price;
        console.log(`  ✅ ${symbol} → ₹${quote.price}`);
      } else {
        priceMap[symbol] = null;
        console.warn(`  ⚠️  ${symbol}: no price returned`);
      }
    } catch (err) {
      priceMap[symbol] = null;
      console.error(`  ❌ ${symbol}: ${err.message}`);
    }
    if (i < unique.length - 1) await delay(300);
  }

  const successCount = Object.values(priceMap).filter(p => p !== null).length;
  console.log(`📊 Yahoo Finance: ${successCount}/${unique.length} prices fetched\n`);
  return priceMap;
};

/**
 * fetchDailyTimeSeries — recent prices for backfill (last 15 trading days).
 */
export const fetchDailyTimeSeries = async (symbol) => {
  const result     = await fetchChart(symbol, { interval: '1d', range: '1mo' });
  const timestamps = result.timestamp || [];
  const closes     = result.indicators?.quote?.[0]?.close || [];

  const prices = {};
  for (let i = 0; i < timestamps.length; i++) {
    const close = closes[i];
    if (close && !isNaN(close)) {
      const d       = new Date(timestamps[i] * 1000).toISOString().split('T')[0];
      prices[d]     = parseFloat(close.toFixed(2));
    }
  }

  const count = Object.keys(prices).length;
  if (count === 0) throw new Error(`NO_VALID_PRICES: ${symbol}`);

  const dates = Object.keys(prices).sort();
  console.log(`  📈 ${symbol}: ${count} days (${dates[0]} → ${dates[dates.length - 1]})`);
  return prices;
};
