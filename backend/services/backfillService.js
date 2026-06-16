// backend/services/backfillService.js
// Runs in background after a new investment is added.
//
// What it does:
//   1. Checks StockMetadata cache — if TIME_SERIES_DAILY was fetched today, reuse it
//   2. If not cached, fetches from Yahoo Finance (1 call per symbol)
//   3. Stores last 10 days of closing prices in StockMetadata.recentPrices
//   4. Creates/updates DailyReport snapshots from buyDate to today for this user
//
// Key design:
//   - NEVER awaited by the caller — investment response is instant
//   - Uses upsert — safe if called multiple times (adding more stocks)
//   - Shared price cache — two users adding same symbol = 1 API call total

import Investment    from '../models/Investment.js';
import DailyReport   from '../models/DailyReport.js';
import MarketBenchmark from '../models/MarketBenchmark.js';
import StockMetadata from '../models/StockMetadata.js';
import User          from '../models/User.js';
import { fetchDailyTimeSeries } from './yahooFinanceService.js';
import { calculatePortfolioMetrics }         from './portfolioService.js';
import { calculateXIRR }                     from './xirrService.js';
import {
  calculateDailyChanges,
  calculateDrawdown,
  calculateBenchmarkComparison,
  calculateStockPerformance,
} from './metricsCalculator.js';
// 500ms between Yahoo Finance calls — enough to avoid rate limiting
const YAHOO_DELAY_MS = 500;

const delay = ms => new Promise(r => setTimeout(r, ms));

// ── Cache helpers ─────────────────────────────────────────────────────────────

/**
 * getRecentPrices
 * Returns cached recentPrices from StockMetadata if fetched today.
 * Returns null if cache is stale or missing → caller must fetch fresh.
 */
const getRecentPrices = async (symbol) => {
  const meta = await StockMetadata.findOne({ symbol: symbol.toUpperCase() })
    .select('recentPrices recentPricesFetchedAt');

  if (!meta?.recentPrices || !meta?.recentPricesFetchedAt) return null;

  // Check if fetched today (IST date comparison)
  const today   = new Date().toISOString().split('T')[0];
  const fetched = new Date(meta.recentPricesFetchedAt).toISOString().split('T')[0];

  return fetched === today ? meta.recentPrices : null;
};

/**
 * saveRecentPrices
 * Stores TIME_SERIES_DAILY result in StockMetadata for other users to reuse today.
 */
const saveRecentPrices = async (symbol, prices) => {
  await StockMetadata.findOneAndUpdate(
    { symbol: symbol.toUpperCase() },
    { $set: { recentPrices: prices, recentPricesFetchedAt: new Date() } },
    { upsert: true }
  );
};

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * storeLastWeekSnapshots
 * ----------------------
 * Called asynchronously after addInvestment saves to DB.
 * Backfills DailyReport snapshots from the new investment's buyDate to today.
 *
 * @param {string} userId          - Firebase UID
 * @param {Date}   newBuyDate      - buy date of the newly added investment
 */
export const storeLastWeekSnapshots = async (userId, newBuyDate) => {
  console.log(`\n🔄 Backfill started — user: ${userId}, from: ${newBuyDate.toISOString().split('T')[0]}`);

  try {
    // 1. Load all user's investments and profile
    const investments = await Investment.find({ userId }).sort({ buyDate: 1 });
    if (!investments.length) return;

    const user = await User.findOne({ uid: userId });
    if (!user) return;

    const uniqueSymbols = [...new Set(investments.map(i => i.symbol))];
    console.log(`📊 Symbols: ${uniqueSymbols.join(', ')}`);

    // 2. Fetch recent price history for each symbol (cache-first)
    // priceHistory: { 'RELIANCE.NS': { '2026-06-05': 1291.50, ... } }
    const priceHistory = {};
    let apiCallMade = false;

    for (let i = 0; i < uniqueSymbols.length; i++) {
      const symbol    = uniqueSymbols[i];
      const cached    = await getRecentPrices(symbol);

      if (cached) {
        // Reuse today's cache — zero API calls
        priceHistory[symbol] = cached;
        console.log(`  ✅ ${symbol}: using cached prices (${Object.keys(cached).length} days)`);
      } else {
        // Not cached today — fetch from Alpha Vantage
        try {
            const data      = await fetchDailyTimeSeries(symbol);
          priceHistory[symbol] = data;
          await saveRecentPrices(symbol, data);
          apiCallMade = true;
          console.log(`  ✅ ${symbol}: fetched ${Object.keys(data).length} days`);
        } catch (err) {
          if (err.message === 'RATE_LIMIT') {
            // Alpha Vantage rate limit hit — gracefully skip backfill
            // Daily cron at 3:35 PM will catch up
            console.warn(`  ⚠️  Rate limit hit on ${symbol}. Backfill skipped — cron will handle it.`);
            return; // exit cleanly, investment is already saved
          }
          console.error(`  ❌ ${symbol}: ${err.message}`);
          priceHistory[symbol] = {};
        }

        // 500ms delay between Yahoo Finance calls to avoid rate limiting
        if (apiCallMade && i < uniqueSymbols.length - 1) {
          await delay(YAHOO_DELAY_MS);
          apiCallMade = false;
        }
      }
    }

    // 3. Fetch NIFTY 50 history and store in MarketBenchmark
    // ^NSEI = Yahoo Finance symbol for NIFTY 50 index
    // Shared collection — all users benefit from one fetch
    let niftyHistory = {}; // { 'YYYY-MM-DD': value }

    try {
      await delay(YAHOO_DELAY_MS); // small gap before next call
      niftyHistory = await fetchDailyTimeSeries('^NSEI');
      const niftyDates = Object.keys(niftyHistory).sort();

      // Store each day in MarketBenchmark (upsert — shared across all users)
      for (let i = 0; i < niftyDates.length; i++) {
        const dateStr   = niftyDates[i];
        const niftyDate = new Date(`${dateStr}T00:00:00.000Z`);
        const value     = niftyHistory[dateStr];
        const prevValue = i > 0 ? niftyHistory[niftyDates[i - 1]] : value;
        const change    = parseFloat(((value - prevValue) / prevValue * 100).toFixed(2));
        const changeVal = parseFloat((value - prevValue).toFixed(2));

        await MarketBenchmark.findOneAndUpdate(
          { date: niftyDate },
          { $set: { nifty50: value, nifty50Change: change, nifty50ChangeValue: changeVal } },
          { upsert: true }
        );
      }
      console.log(`  ✅ ^NSEI: ${niftyDates.length} days stored in MarketBenchmark`);
    } catch (err) {
      console.warn(`  ⚠️  NIFTY fetch failed: ${err.message}. Benchmark data will be empty.`);
    }

    // 3. Get available trading dates (use first symbol with data as reference)
    const baseSymbol = uniqueSymbols.find(s => Object.keys(priceHistory[s] || {}).length > 0);
    if (!baseSymbol) {
      console.warn('⚠️  No price data available. Backfill skipped.');
      return;
    }

    // Sort oldest-first so drawdown chain is correct
    const newBuyDateStr = newBuyDate.toISOString().split('T')[0];
    const daysToFill    = Object.keys(priceHistory[baseSymbol])
      .filter(d => d >= newBuyDateStr)
      .sort();

    if (!daysToFill.length) {
      console.warn(`⚠️  No dates >= ${newBuyDateStr} in price data. Backfill skipped.`);
      return;
    }

    console.log(`📅 Filling ${daysToFill.length} day(s): ${daysToFill[0]} → ${daysToFill[daysToFill.length - 1]}`);

    // 4. For each trading day, compute and upsert DailyReport
    for (const dateStr of daysToFill) {
      const day = new Date(`${dateStr}T00:00:00.000Z`);

      // Only include investments purchased on or before this day
      const activeInvs = investments.filter(inv => new Date(inv.buyDate) <= day);
      if (!activeInvs.length) continue;

      // Build price map for this day — skip stocks with no price data
      const dayPriceMap = {};
      for (const inv of activeInvs) {
        const price = priceHistory[inv.symbol]?.[dateStr];
        if (price) dayPriceMap[inv.symbol] = price;
      }

      // Skip day if no prices at all (weekend or missing data)
      if (!Object.keys(dayPriceMap).length) continue;

      // Previous snapshot for the drawdown chain
      const prevSnapshot = await DailyReport
        .findOne({ userId, date: { $lt: day } })
        .sort({ date: -1 })
        .limit(1);

      // Calculate all metrics
      const metrics    = calculatePortfolioMetrics(activeInvs, dayPriceMap, user.firstInvestmentDate);
      const xirrValue  = calculateXIRR(activeInvs, metrics.currentValue, day);
      const stockPerf  = calculateStockPerformance(
        activeInvs,
        dayPriceMap,
        prevSnapshot?.stockPerformance,
        metrics.currentValue
      );
      const dailyChanges = calculateDailyChanges(stockPerf);
      const drawdown     = calculateDrawdown(
        metrics.currentValue,
        metrics.totalInvested,
        prevSnapshot?.peakReturn ?? null
      );

      // NIFTY benchmark — use in-memory history (no DB query per day)
      let benchmarkComparison = {};
      const niftyValue = niftyHistory[dateStr];
      if (niftyValue) {
        const niftyDates  = Object.keys(niftyHistory).sort();
        const prevDateStr = niftyDates[niftyDates.indexOf(dateStr) - 1];
        const prevNifty   = prevDateStr ? niftyHistory[prevDateStr] : niftyValue;
        const niftyChange = parseFloat(((niftyValue - prevNifty) / prevNifty * 100).toFixed(2));

        benchmarkComparison = calculateBenchmarkComparison(
          dailyChanges.dailyReturn,
          niftyChange,
          niftyValue
        );
      }

      // Upsert: create if no snapshot exists, update if it does
      await DailyReport.findOneAndUpdate(
        { userId, date: day },
        {
          $set: {
            totalInvested:    metrics.totalInvested,
            portfolioValue:   metrics.currentValue,
            profitLoss:       metrics.profitLoss,
            roi:              metrics.roi,
            cagr:             metrics.cagr,
            xirr:             xirrValue,
            absoluteReturn:   metrics.absoluteReturn,
            totalHoldings:    metrics.totalHoldings,
            dailyReturn:      dailyChanges.dailyReturn,
            dailyProfitLoss:  dailyChanges.dailyProfitLoss,
            peakReturn:       drawdown.peakReturn,
            currentDrawdown:  drawdown.currentDrawdown,
            benchmarkComparison,
            stockPerformance: stockPerf,
          },
        },
        { upsert: true }
      );

      console.log(`  ✅ ${dateStr}: ₹${metrics.currentValue.toLocaleString('en-IN')}`);
    }

    // 5. Mark all user's unprocessed investments as done
    await Investment.updateMany(
      { userId, isProcessed: false },
      { isProcessed: true, processedAt: new Date() }
    );

    console.log(`✅ Backfill complete for ${userId}\n`);

  } catch (err) {
    // Never throw — investment is already saved, backfill is best-effort
    console.error(`❌ Backfill failed for ${userId}:`, err.message);
  }
};
