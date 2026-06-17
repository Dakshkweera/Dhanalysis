// backend/services/backfillService.js
// Runs in background after a new investment is added.
//
// What it does:
//   1. For each symbol, checks StockMetadata.priceHistory (shared cache):
//      - earliest cached date <= newBuyDate AND cache has recent data → use cache, zero API calls
//      - otherwise → fetch full range (newBuyDate → today), overwrite priceHistory
//   2. Checks MarketBenchmark for NIFTY (same cache logic as StockMetadata):
//      - cache covers range and is recent → load from DB, zero API call
//      - otherwise → delete all, refetch from newBuyDate → today, store back
//   3. Deletes DailyReports from newBuyDate onwards (stale — new stock changes metrics)
//   4. Recreates DailyReports day by day from newBuyDate to today
//   5. Marks all unprocessed investments as done
//
// Key design:
//   - NEVER awaited by the caller — investment response is instant
//   - priceHistory and MarketBenchmark are shared — one fetch benefits all users
//   - Cron appends today's price to both daily, so caches grow automatically

import Investment      from '../models/Investment.js';
import DailyReport     from '../models/DailyReport.js';
import MarketBenchmark from '../models/MarketBenchmark.js';
import StockMetadata   from '../models/StockMetadata.js';
import User            from '../models/User.js';
import { fetchPriceRange }           from './yahooFinanceService.js';
import { calculatePortfolioMetrics } from './portfolioService.js';
import { calculateXIRR }             from './xirrService.js';
import {
  calculateDailyChanges,
  calculateDrawdown,
  calculateBenchmarkComparison,
  calculateStockPerformance,
} from './metricsCalculator.js';

const YAHOO_DELAY_MS = 500;
const delay = ms => new Promise(r => setTimeout(r, ms));

export const storeLastWeekSnapshots = async (userId, newBuyDate) => {
  console.log(`\n🔄 Backfill started — user: ${userId}, from: ${newBuyDate.toISOString().split('T')[0]}`);

  try {
    const investments = await Investment.find({ userId }).sort({ buyDate: 1 });
    if (!investments.length) return;

    const user = await User.findOne({ uid: userId });
    if (!user) return;

    const uniqueSymbols = [...new Set(investments.map(i => i.symbol))];
    const newBuyDateStr = newBuyDate.toISOString().split('T')[0];
    const today         = new Date();

    console.log(`📊 Symbols: ${uniqueSymbols.join(', ')}`);

    // 1. For each symbol, get price history (cache-first via StockMetadata.priceHistory)
    // symbolPriceMap: { 'TCS.NS': { '2026-03-01': 1250.50, ... } }
    const symbolPriceMap = {};

    for (const symbol of uniqueSymbols) {
      const meta          = await StockMetadata.findOne({ symbol: symbol.toUpperCase() }).select('priceHistory');
      const cached        = meta?.priceHistory || {};
      const cachedDates   = Object.keys(cached).sort();
      const earliestCached = cachedDates[0];

      // Cache is valid only if it covers BOTH the buy date AND recent data.
      // 5-day gap allowed for weekends/holidays.
      const latestCached   = cachedDates[cachedDates.length - 1];
      const fiveDaysAgo    = new Date(today);
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
      const fiveDaysAgoStr = fiveDaysAgo.toISOString().split('T')[0];
      const cacheValid     = earliestCached && newBuyDateStr >= earliestCached && latestCached >= fiveDaysAgoStr;

      if (cacheValid) {
        // Cache covers both the buy date and recent data — use directly, zero API call
        symbolPriceMap[symbol] = cached;
        console.log(`  ✅ ${symbol}: cache hit (from ${earliestCached}, ${cachedDates.length} days)`);
      } else {
        // Cache missing or doesn't go back far enough — fetch full range
        try {
          await delay(YAHOO_DELAY_MS);
          const freshPrices = await fetchPriceRange(symbol, newBuyDate, today);

          // Overwrite priceHistory with new full range (wider than before)
          await StockMetadata.findOneAndUpdate(
            { symbol: symbol.toUpperCase() },
            { $set: { priceHistory: freshPrices, priceHistoryUpdatedAt: new Date() } },
            { upsert: true }
          );

          symbolPriceMap[symbol] = freshPrices;
        } catch (err) {
          console.error(`  ❌ ${symbol}: ${err.message}`);
          symbolPriceMap[symbol] = {};
        }
      }
    }

    // 2. NIFTY history — same cache logic as StockMetadata.priceHistory
    // MarketBenchmark is shared across all users, cron appends today's value daily
    let niftyHistory = {};
    try {
      const earliestDoc = await MarketBenchmark.findOne().sort({ date:  1 }).select('date');
      const latestDoc   = await MarketBenchmark.findOne().sort({ date: -1 }).select('date');

      const earliestStr = earliestDoc ? earliestDoc.date.toISOString().split('T')[0] : null;
      const latestStr   = latestDoc   ? latestDoc.date.toISOString().split('T')[0]   : null;

      const fiveDaysAgo    = new Date(today);
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
      const fiveDaysAgoStr = fiveDaysAgo.toISOString().split('T')[0];

      const cacheValid = earliestStr && latestStr
        && newBuyDateStr >= earliestStr
        && latestStr >= fiveDaysAgoStr;

      if (cacheValid) {
        // Load from MarketBenchmark — zero API call
        const docs = await MarketBenchmark
          .find({ date: { $gte: new Date(`${newBuyDateStr}T00:00:00.000Z`) } })
          .sort({ date: 1 })
          .select('date nifty50');

        for (const doc of docs) {
          niftyHistory[doc.date.toISOString().split('T')[0]] = doc.nifty50;
        }
        console.log(`  ✅ ^NSEI: cache hit (${Object.keys(niftyHistory).length} days from MarketBenchmark)`);
      } else {
        // Cache missing or doesn't go back far enough — delete and refetch
        await MarketBenchmark.deleteMany({});
        await delay(YAHOO_DELAY_MS);
        niftyHistory = await fetchPriceRange('^NSEI', newBuyDate, today);
        const niftyDates = Object.keys(niftyHistory).sort();

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
        console.log(`  ✅ ^NSEI: fetched and stored ${niftyDates.length} days in MarketBenchmark`);
      }
    } catch (err) {
      console.warn(`  ⚠️  NIFTY fetch failed: ${err.message}. Benchmark data will be empty.`);
    }

    // 3. Delete existing DailyReports from newBuyDate onwards
    // New stock changes all portfolio metrics from its buy date forward
    const newBuyDateObj = new Date(`${newBuyDateStr}T00:00:00.000Z`);
    const deleted = await DailyReport.deleteMany({ userId, date: { $gte: newBuyDateObj } });
    console.log(`🗑  Deleted ${deleted.deletedCount} DailyReports from ${newBuyDateStr} onwards`);

    // 4. Get all trading dates from price data
    const baseSymbol = uniqueSymbols.find(s => Object.keys(symbolPriceMap[s] || {}).length > 0);
    if (!baseSymbol) {
      console.warn('⚠️  No price data available. Backfill skipped.');
      return;
    }

    const daysToFill = Object.keys(symbolPriceMap[baseSymbol])
      .filter(d => d >= newBuyDateStr)
      .sort();

    if (!daysToFill.length) {
      console.warn(`⚠️  No dates >= ${newBuyDateStr} in price data. Backfill skipped.`);
      return;
    }

    console.log(`📅 Filling ${daysToFill.length} day(s): ${daysToFill[0]} → ${daysToFill[daysToFill.length - 1]}`);

    // 5. Loop day by day and upsert DailyReports
    for (const dateStr of daysToFill) {
      const day = new Date(`${dateStr}T00:00:00.000Z`);

      // Only include investments purchased on or before this day
      const activeInvs = investments.filter(inv => new Date(inv.buyDate) <= day);
      if (!activeInvs.length) continue;

      const dayPriceMap = {};
      for (const inv of activeInvs) {
        const price = symbolPriceMap[inv.symbol]?.[dateStr];
        if (price) dayPriceMap[inv.symbol] = price;
      }
      if (!Object.keys(dayPriceMap).length) continue;

      const prevSnapshot = await DailyReport
        .findOne({ userId, date: { $lt: day } })
        .sort({ date: -1 })
        .limit(1);

      const metrics      = calculatePortfolioMetrics(activeInvs, dayPriceMap, user.firstInvestmentDate);
      const xirrValue    = calculateXIRR(activeInvs, metrics.currentValue, day);
      const stockPerf    = calculateStockPerformance(activeInvs, dayPriceMap, prevSnapshot?.stockPerformance, metrics.currentValue);
      const dailyChanges = calculateDailyChanges(stockPerf);
      const drawdown     = calculateDrawdown(metrics.currentValue, metrics.totalInvested, prevSnapshot?.peakReturn ?? null);

      let benchmarkComparison = {};
      const niftyValue = niftyHistory[dateStr];
      if (niftyValue) {
        const niftyDates  = Object.keys(niftyHistory).sort();
        const prevDateStr = niftyDates[niftyDates.indexOf(dateStr) - 1];
        const prevNifty   = prevDateStr ? niftyHistory[prevDateStr] : niftyValue;
        const niftyChange = parseFloat(((niftyValue - prevNifty) / prevNifty * 100).toFixed(2));
        benchmarkComparison = calculateBenchmarkComparison(dailyChanges.dailyReturn, niftyChange, niftyValue);
      }

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

    // 6. Mark all unprocessed investments as done
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
