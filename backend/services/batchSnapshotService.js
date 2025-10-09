// services/batchSnapshotService.js

import Investment from '../models/Investment.js';
import DailyReport from '../models/DailyReport.js';
import MarketBenchmark from '../models/MarketBenchmark.js';
import User from '../models/User.js';
import { ensureNiftyDataExists } from '../utils/niftyBackfill.js';
import { fetchMultipleStockPrices } from '../utils/historicalPrices.js';
import { calculateXIRR } from '../services/xirrService.js';

/**
 * Calculate CAGR
 */
const calculateCAGR = (initialValue, finalValue, days) => {
  if (initialValue <= 0 || finalValue <= 0 || days <= 0) return 0;
  const years = days / 365;
  if (years < 0.02) return 0;
  const cagr = (Math.pow(finalValue / initialValue, 1 / years) - 1) * 100;
  if (cagr < -99) return -99.99;
  if (cagr > 999) return 999.99;
  return parseFloat(cagr.toFixed(2));
};

/**
 * Generate trading days between two dates (skip weekends)
 */
const getTradingDays = (startDate, endDate) => {
  const days = [];
  const current = new Date(startDate);
  const end = new Date(endDate);

  while (current <= end) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      days.push(new Date(current));
    }
    current.setDate(current.getDate() + 1);
  }

  return days;
};

/**
 * SMART Batch Processing Function
 * Only processes unprocessed investments and updates snapshots accordingly
 */
export const generateHistoricalSnapshots = async (userId, options = {}) => {
  const { force = false } = options;
  
  try {
    console.log(`📊 Starting SMART batch snapshot generation for user ${userId}`);
    console.log(`🔧 Force mode: ${force ? 'ON' : 'OFF'}`);

    // Step 1: Get all investments sorted by buyDate
    const allInvestments = await Investment.find({ userId }).sort({ buyDate: 1 });

    if (allInvestments.length === 0) {
      return { success: false, message: 'No investments found' };
    }

    // Step 2: Find earliest UNPROCESSED investment
    const unprocessedInvestments = allInvestments.filter(inv => !inv.isProcessed);
    
    console.log(`📈 Total investments: ${allInvestments.length}`);
    console.log(`⏳ Unprocessed investments: ${unprocessedInvestments.length}`);

    // If force mode, mark all as unprocessed and delete snapshots
    if (force) {
      console.log('🔄 Force mode: Resetting all investments to unprocessed...');
      await Investment.updateMany({ userId }, { 
        isProcessed: false,
        processedAt: null
      });
      
      console.log('🗑️ Deleting all existing snapshots...');
      await DailyReport.deleteMany({ userId });
      
      // Reload investments
      unprocessedInvestments.length = 0;
      unprocessedInvestments.push(...allInvestments);
    }

    // If all investments already processed, nothing to do
    if (unprocessedInvestments.length === 0) {
      console.log('✅ All investments already processed. Nothing to do.');
      return {
        success: true,
        snapshotsCreated: 0,
        message: 'All investments already processed',
        dateRange: null
      };
    }

    // Step 3: Find the earliest unprocessed investment date
    const earliestUnprocessed = unprocessedInvestments[0];
    const startDate = new Date(earliestUnprocessed.buyDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    console.log(`📅 Processing from: ${startDate.toISOString().split('T')[0]} to ${today.toISOString().split('T')[0]}`);
    console.log(`🎯 Earliest unprocessed investment: ${earliestUnprocessed.symbol} (${startDate.toISOString().split('T')[0]})`);

    // Step 4: Delete snapshots from startDate onwards (need to recalculate with new investments)
    const deletedCount = await DailyReport.deleteMany({
      userId,
      date: { $gte: startDate.toISOString().split('T')[0] }
    });
    
    console.log(`🗑️ Deleted ${deletedCount.deletedCount} snapshots from ${startDate.toISOString().split('T')[0]} onwards`);

    // Step 5: Update user's firstInvestmentDate if needed
    const firstInvestment = allInvestments[0];
    const firstBuyDate = new Date(firstInvestment.buyDate);
    
    await User.findOneAndUpdate(
      { uid: userId },
      { firstInvestmentDate: firstBuyDate }
    );

    // Step 6: Ensure NIFTY data exists
    console.log('📊 Checking NIFTY data availability...');
    await ensureNiftyDataExists(startDate, today);

    // Step 7: Get trading days from startDate to today
    const tradingDays = getTradingDays(startDate, today);
    console.log(`📆 Processing ${tradingDays.length} trading days`);

    let snapshotsCreated = 0;
    let apiCallCount = 0;

    // Step 8: Generate snapshots day by day
    for (let i = 0; i < tradingDays.length; i++) {
      const currentDate = tradingDays[i];
      const dateStr = currentDate.toISOString().split('T')[0];

      // Get investments that existed on this date
      const activeInvestments = allInvestments.filter(inv => {
        const invDate = new Date(inv.buyDate);
        return invDate <= currentDate;
      });

      if (activeInvestments.length === 0) {
        continue;
      }

      // Fetch stock prices
      const symbols = [...new Set(activeInvestments.map(inv => inv.symbol))];
      const stockPrices = await fetchMultipleStockPrices(symbols, dateStr);
      apiCallCount += symbols.length;

      // Calculate portfolio
      let totalInvested = 0;
      let totalValue = 0;

      for (const investment of activeInvestments) {
        const currentPrice = stockPrices[investment.symbol];
        
        if (currentPrice && currentPrice > 0) {
          totalInvested += investment.quantity * investment.buyPrice;
          totalValue += investment.quantity * currentPrice;
        } else {
          console.warn(`⚠️ Missing price for ${investment.symbol} on ${dateStr}, using buy price`);
          totalInvested += investment.quantity * investment.buyPrice;
          totalValue += investment.quantity * investment.buyPrice;
        }
      }

      if (totalInvested <= 0) continue;

      // Calculate metrics
      const daysSinceStart = Math.floor((currentDate - firstBuyDate) / (1000 * 60 * 60 * 24));
      const cagr = calculateCAGR(totalInvested, totalValue, daysSinceStart);

      // Calculate XIRR only for today
      let xirrValue = null;
      const isToday = dateStr === today.toISOString().split('T')[0];
      if (isToday && daysSinceStart >= 7) {
        xirrValue = calculateXIRR(activeInvestments, totalValue);
      }

      // Get NIFTY data
      const niftyRecord = await MarketBenchmark.findOne({ date: dateStr });
      const nifty50Value = niftyRecord ? niftyRecord.nifty50 : null;

      // Create snapshot
      await DailyReport.create({
        userId,
        date: dateStr,
        totalInvested,
        portfolioValue: totalValue,
        profitLoss: totalValue - totalInvested,
        roi: ((totalValue - totalInvested) / totalInvested) * 100,
        cagr,
        xirr: xirrValue,
        absoluteReturn: totalValue - totalInvested,
        totalHoldings: activeInvestments.length,
        benchmarkComparison: {
          nifty50Value
        }
      });

      snapshotsCreated++;

      // Rate limiting
      if (apiCallCount >= 750) {
        console.log(`⏸️ Pausing after ${apiCallCount} API calls...`);
        await new Promise(resolve => setTimeout(resolve, 60000));
        apiCallCount = 0;
      }

      // Progress logging
      if ((i + 1) % 50 === 0) {
        console.log(`⏳ Progress: ${i + 1}/${tradingDays.length} days (${snapshotsCreated} created)`);
      }
    }

    // Step 9: Mark all unprocessed investments as processed
    const unprocessedIds = unprocessedInvestments.map(inv => inv._id);
    await Investment.updateMany(
      { _id: { $in: unprocessedIds } },
      { 
        isProcessed: true,
        processedAt: new Date()
      }
    );

    console.log(`✅ Marked ${unprocessedIds.length} investments as processed`);
    console.log(`✅ Batch processing complete! Created ${snapshotsCreated} snapshots`);

    return {
      success: true,
      snapshotsCreated,
      investmentsProcessed: unprocessedIds.length,
      dateRange: {
        from: startDate.toISOString().split('T')[0],
        to: today.toISOString().split('T')[0]
      }
    };

  } catch (error) {
    console.error('❌ Batch snapshot generation error:', error);
    throw error;
  }
};
