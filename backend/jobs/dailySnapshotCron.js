// backend/jobs/dailySnapshotCron.js
// Daily portfolio snapshot cron — runs Mon-Fri at 3:35 PM IST.
//
// Key design:
//   1. Collect ALL unique symbols across ALL users
//   2. Fetch prices ONCE via priceStoreService.bulkRefresh (deduped)
//   3. Build each user's snapshot from the shared price store
//   4. Send emails in parallel (Promise.allSettled)

import cron from 'node-cron';
import User from '../models/User.js';
import Investment from '../models/Investment.js';
import DailyReport from '../models/DailyReport.js';
import { bulkRefresh, getMany } from '../services/priceStoreService.js';
import { calculatePortfolioMetrics, findTopPerformers } from '../services/portfolioService.js';
import { sendPortfolioEmail } from '../services/emailService.js';
import { calculateXIRR } from '../services/xirrService.js';
import { getNiftyForDate } from '../services/niftyService.js';
import { getISTDate, getISTTimestamp } from '../utils/timezone.js';
import MarketBenchmark from '../models/MarketBenchmark.js';
import {
  calculateDailyChanges,
  calculateDrawdown,
  calculateBenchmarkComparison,
  calculateStockPerformance,
} from '../services/metricsCalculator.js';
import { IST_TIMEZONE } from '../config/constants.js';

// ── Single user snapshot ──────────────────────────────────────────────────────

const createSnapshotForUser = async (userId, priceMap, today) => {
  try {
    console.log(`  📸 Snapshot: ${userId}`);

    // Skip if already done today
    const existing = await DailyReport.findOne({ userId, date: today });
    if (existing) {
      console.log(`  ⏭  Already exists for ${userId}`);
      return { success: true, skipped: true };
    }

    const user = await User.findOne({ uid: userId });
    if (!user) return { success: false, message: 'User not found' };

    const investments = await Investment.find({ userId });

    if (investments.length === 0) {
      await DailyReport.create({
        userId,
        date: today,
        totalInvested: 0, portfolioValue: 0,
        profitLoss: 0, roi: 0, cagr: 0,
        absoluteReturn: 0, totalHoldings: 0,
        dailyReturn: 0, dailyProfitLoss: 0,
        peakReturn: 0, currentDrawdown: 0,
        benchmarkComparison: {}, stockPerformance: [],
      });
      return { success: true };
    }

    // Use shared price map (no extra API calls)
    const metrics = calculatePortfolioMetrics(investments, priceMap, user.firstInvestmentDate);
    const xirrValue = calculateXIRR(investments, metrics.currentValue, today);
    const topPerformers = findTopPerformers(investments, priceMap);

    // Yesterday's snapshot (handles weekends/holidays)
    const yesterdaySnapshot = await DailyReport
      .findOne({ userId, date: { $lt: today } })
      .sort({ date: -1 })
      .limit(1);

    const stockPerformance = calculateStockPerformance(
      investments,
      priceMap,
      yesterdaySnapshot?.stockPerformance,
      metrics.currentValue
    );

    const dailyChanges = calculateDailyChanges(stockPerformance);
    const drawdown = calculateDrawdown(
      metrics.currentValue,
      metrics.totalInvested,
      yesterdaySnapshot?.peakReturn ?? null
    );

    // Benchmark comparison
    let benchmarkComparison = {};
    try {
      const todayBenchmark = await getNiftyForDate(today);
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayBenchmark = await MarketBenchmark.findOne({ date: { $lte: yesterday } }).sort({ date: -1 }).limit(1);

      const niftyDailyReturn = yesterdayBenchmark?.nifty50
        ? ((todayBenchmark.nifty50 - yesterdayBenchmark.nifty50) / yesterdayBenchmark.nifty50) * 100
        : todayBenchmark.nifty50Change || 0;

      benchmarkComparison = calculateBenchmarkComparison(
        dailyChanges.dailyReturn,
        niftyDailyReturn,
        todayBenchmark.nifty50
      );
    } catch (err) {
      console.warn(`  ⚠️  Benchmark skipped for ${userId}: ${err.message}`);
    }

    // Daily change (capital-aware)
    let dailyChange = null;
    if (yesterdaySnapshot) {
      const portfolioValueChange = metrics.currentValue - yesterdaySnapshot.portfolioValue;
      const newCapitalAdded = metrics.totalInvested - yesterdaySnapshot.totalInvested;
      const marketChange = portfolioValueChange - newCapitalAdded;
      const totalPercentage = (portfolioValueChange / yesterdaySnapshot.portfolioValue) * 100;
      const marketChangePercentage = yesterdaySnapshot.portfolioValue > 0
        ? (marketChange / yesterdaySnapshot.portfolioValue) * 100
        : 0;
      dailyChange = {
        portfolioValue:           parseFloat(portfolioValueChange.toFixed(2)),
        percentage:               parseFloat(totalPercentage.toFixed(2)),
        newCapitalAdded:          parseFloat(newCapitalAdded.toFixed(2)),
        marketChange:             parseFloat(marketChange.toFixed(2)),
        marketChangePercentage:   parseFloat(marketChangePercentage.toFixed(2)),
      };
    }

    await DailyReport.create({
      userId,
      date: today,
      totalInvested:     metrics.totalInvested,
      portfolioValue:    metrics.currentValue,
      profitLoss:        metrics.profitLoss,
      roi:               metrics.roi,
      cagr:              metrics.cagr,
      xirr:              xirrValue,
      absoluteReturn:    metrics.absoluteReturn,
      totalHoldings:     metrics.totalHoldings,
      dailyReturn:       dailyChanges.dailyReturn,
      dailyProfitLoss:   dailyChanges.dailyProfitLoss,
      peakReturn:        drawdown.peakReturn,
      currentDrawdown:   drawdown.currentDrawdown,
      benchmarkComparison,
      stockPerformance,
      dailyChange,
      topPerformers: { best: topPerformers.best, worst: topPerformers.worst },
    });

    console.log(`  ✅ Snapshot created: ${userId}`);
    return { success: true };
  } catch (err) {
    console.error(`  ❌ Snapshot failed for ${userId}:`, err.message);
    return { success: false, message: err.message };
  }
};

// ── Email for one user ────────────────────────────────────────────────────────

const sendEmailForUser = async (userId, today) => {
  try {
    const user = await User.findOne({ uid: userId });
    if (!user?.email) return { userId, status: 'skipped', reason: 'no email' };
    if (user.notifications?.email === false) return { userId, status: 'skipped', reason: 'disabled' };

    const snapshot = await DailyReport.findOne({ userId, date: today });
    if (!snapshot) return { userId, status: 'skipped', reason: 'no snapshot' };

    const result = await sendPortfolioEmail(user.email, user.name || 'User', snapshot);
    return result.success
      ? { userId, status: 'sent' }
      : { userId, status: 'failed', error: result.error };
  } catch (err) {
    return { userId, status: 'error', error: err.message };
  }
};

// ── Main job ──────────────────────────────────────────────────────────────────

const runDailyJob = async () => {
  console.log('\n=== Daily Snapshot Cron Started ===');
  console.log('Time:', getISTTimestamp());

  const today = getISTDate();

  // All users with at least one investment
  const userIds = await Investment.distinct('userId');
  if (userIds.length === 0) {
    console.log('No users with investments. Exiting.');
    return;
  }
  console.log(`Found ${userIds.length} user(s) with investments`);

  // ── Step 1: Fetch all unique symbols ONCE ──────────────────────────────────
  const allInvestments = await Investment.find({ userId: { $in: userIds } }).select('symbol');
  const uniqueSymbols = [...new Set(allInvestments.map(i => i.symbol))];
  console.log(`\n📦 Unique symbols across all users: ${uniqueSymbols.length}`);

  const priceMap = await bulkRefresh(uniqueSymbols);

  // ── Step 2: Create snapshots (sequential to avoid DB hammering) ────────────
  console.log('\n📸 Creating snapshots...');
  let snapshotsOk = 0;
  for (const userId of userIds) {
    const result = await createSnapshotForUser(userId, priceMap, today);
    if (result.success) snapshotsOk++;
  }
  console.log(`✅ Snapshots: ${snapshotsOk}/${userIds.length} successful`);

  // ── Step 3: Send emails IN PARALLEL ───────────────────────────────────────
  console.log('\n📧 Sending emails...');
  const emailResults = await Promise.allSettled(
    userIds.map(userId => sendEmailForUser(userId, today))
  );

  const sent    = emailResults.filter(r => r.status === 'fulfilled' && r.value.status === 'sent').length;
  const skipped = emailResults.filter(r => r.status === 'fulfilled' && r.value.status === 'skipped').length;
  const failed  = emailResults.filter(r => r.status !== 'fulfilled' || r.value.status === 'failed' || r.value.status === 'error').length;

  console.log(`📧 Emails — Sent: ${sent} | Skipped: ${skipped} | Failed: ${failed}`);
  console.log('=== Daily Snapshot Cron Completed ===\n');
};

// ── Schedule ──────────────────────────────────────────────────────────────────

export const startDailySnapshotCron = () => {
  // Mon-Fri at 3:35 PM IST (after NSE market close at 3:30 PM)
  cron.schedule('35 15 * * 1-5', runDailyJob, { timezone: IST_TIMEZONE });
  console.log(`✅ Cron scheduled: 3:35 PM IST (Mon-Fri)`);
};

