// backend/services/niftyService.js
// Fetches NIFTY 50 benchmark data via NIFTYBEES.BSE ETF on Alpha Vantage.
// NIFTYBEES tracks NIFTY 50 with ~99.9% accuracy — same daily % change.

import MarketBenchmark from '../models/MarketBenchmark.js';
import { getStockQuote } from './yahooFinanceService.js';

// Yahoo Finance uses ^NSEI for NIFTY 50 index directly
const NIFTY_PROXY_SYMBOL = '^NSEI';

/**
 * Fetches current NIFTY 50 value via NIFTYBEES proxy.
 * Returns { value, change, changePercent }.
 */
export const fetchNiftyValue = async () => {
  try {
    console.log(`📊 Fetching NIFTY benchmark via ${NIFTY_PROXY_SYMBOL}...`);

    const quote = await getStockQuote(NIFTY_PROXY_SYMBOL);

    const niftyData = {
      value:         quote.price,
      change:        quote.change,
      changePercent: quote.changePercent,
    };

    console.log(`✅ NIFTY (via ${NIFTY_PROXY_SYMBOL}): ₹${niftyData.value} (${niftyData.changePercent?.toFixed(2)}%)`);
    return niftyData;
  } catch (error) {
    console.error('❌ Error fetching NIFTY benchmark:', error.message);
    throw error;
  }
};

/**
 * Returns today's MarketBenchmark document, creating it if it doesn't exist.
 * Uses MongoDB as a day-level cache — only one Alpha Vantage call per calendar day.
 */
export const getNiftyForDate = async (date) => {
  try {
    const normalizedDate = new Date(Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      0, 0, 0, 0
    ));

    // DB cache hit — no API call needed
    const existing = await MarketBenchmark.findOne({ date: normalizedDate });
    if (existing) {
      console.log(`✅ NIFTY: using cached value for ${normalizedDate.toISOString().split('T')[0]}`);
      return existing;
    }

    // Fetch fresh and persist
    const niftyData = await fetchNiftyValue();

    const benchmark = await MarketBenchmark.create({
      date:              normalizedDate,
      nifty50:           niftyData.value,
      nifty50Change:     niftyData.changePercent || 0,
      nifty50ChangeValue: niftyData.change || 0,
    });

    console.log(`✅ NIFTY saved for ${normalizedDate.toISOString().split('T')[0]}`);
    return benchmark;
  } catch (error) {
    console.error('❌ Error in getNiftyForDate:', error.message);
    throw error;
  }
};

/**
 * Calculates NIFTY % return between two dates using stored benchmark data.
 */
export const calculateNiftyReturn = async (startDate, endDate) => {
  try {
    const [startBenchmark, endBenchmark] = await Promise.all([
      MarketBenchmark.findOne({ date: { $lte: startDate } }).sort({ date: -1 }).limit(1),
      MarketBenchmark.findOne({ date: { $lte: endDate   } }).sort({ date: -1 }).limit(1),
    ]);

    if (!startBenchmark || !endBenchmark) return null;

    const niftyReturn =
      ((endBenchmark.nifty50 - startBenchmark.nifty50) / startBenchmark.nifty50) * 100;

    return {
      startValue: startBenchmark.nifty50,
      endValue:   endBenchmark.nifty50,
      return:     parseFloat(niftyReturn.toFixed(2)),
    };
  } catch (error) {
    console.error('❌ Error calculating NIFTY return:', error.message);
    return null;
  }
};
