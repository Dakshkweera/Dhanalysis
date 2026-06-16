// backend/services/batchSnapshotService.js
// Runs daily at 3:35 PM IST via cron to create portfolio snapshots for ALL users.
// Fetches current prices in one batch, calculates metrics per user, and sends
// email reports. This is the engine behind the daily portfolio email.

import Investment from '../models/Investment.js';
import DailyReport from '../models/DailyReport.js';
import MarketBenchmark from '../models/MarketBenchmark.js';
import User from '../models/User.js';
import { ensureNiftyDataExists } from '../utils/niftyBackfill.js';
import { fetchMultipleStockPrices } from '../utils/historicalPrices.js';
import { calculateXIRR } from '../services/xirrService.js';
import {
  calculateDailyChanges,
  calculateDrawdown,
  calculateBenchmarkComparison,
  calculateStockPerformance,
  calculateCAGR
} from './metricsCalculator.js';

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
 * SMART Batch Processing with Enhanced Metrics + Robust Holiday Detection
 */
export const generateHistoricalSnapshots = async (userId, options = {}) => {
  const { force = false, onProgress } = options;
  
  try {
    console.log(`📊 Starting SMART batch snapshot generation for user ${userId}`);
    console.log(`🔧 Force mode: ${force ? 'ON' : 'OFF'}`);

    // Step 1: Get all investments sorted by buyDate
    const allInvestments = await Investment.find({ userId }).sort({ buyDate: 1 });

    if (allInvestments.length === 0) {
      return { success: false, message: 'No investments found' };
    }

    // Step 2: Find earliest UNPROCESSED investment
    let unprocessedInvestments = allInvestments.filter(inv => !inv.isProcessed);
    
    console.log(`📈 Total investments: ${allInvestments.length}`);
    console.log(`⏳ Unprocessed investments (before force): ${unprocessedInvestments.length}`);

    // If force mode, mark all as unprocessed and delete snapshots
    if (force) {
      console.log('🔄 Force mode: Resetting all investments to unprocessed...');
      
      await Investment.updateMany(
        { userId }, 
        { 
          isProcessed: false,
          processedAt: null
        }
      );
      
      console.log('🗑️ Deleting all existing snapshots...');
      await DailyReport.deleteMany({ userId });
      
      console.log('🔄 Reloading investments from database...');
      const reloadedInvestments = await Investment.find({ userId }).sort({ buyDate: 1 });
      unprocessedInvestments = reloadedInvestments;
      
      console.log(`✅ Force mode complete: ${unprocessedInvestments.length} investments marked as unprocessed`);
    }

    // Check if there are any unprocessed investments
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

    // Step 4: Delete snapshots from startDate onwards
    const deletedCount = await DailyReport.deleteMany({
      userId,
      date: { $gte: startDate }
    });
    
    console.log(`🗑️ Deleted ${deletedCount.deletedCount} snapshots from ${startDate.toISOString().split('T')[0]} onwards`);

    // Step 5: Update user's firstInvestmentDate
    const firstInvestment = allInvestments[0];
    const firstBuyDate = new Date(firstInvestment.buyDate);
    
    await User.findOneAndUpdate(
      { uid: userId },
      { firstInvestmentDate: firstBuyDate }
    );

    // Step 6: Ensure NIFTY data exists
    console.log('📊 Checking NIFTY data availability...');
    await ensureNiftyDataExists(startDate, today);

    // Step 7: Get trading days
    const tradingDays = getTradingDays(startDate, today);
    console.log(`📆 Processing ${tradingDays.length} potential trading days`);

    let snapshotsCreated = 0;
    let daysSkipped = 0;
    let apiCallCount = 0;

    // Step 8: Generate snapshots day by day
    for (let i = 0; i < tradingDays.length; i++) {
      const currentDate = tradingDays[i];
      const dateStr = currentDate.toISOString().split('T')[0];

      // Progress callback
      if (onProgress && (i + 1) % 10 === 0) {
        onProgress({
          current: i + 1,
          total: tradingDays.length,
          percentage: Math.round(((i + 1) / tradingDays.length) * 100),
          currentDate: dateStr
        });
      }

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

      // ===== COMPREHENSIVE HOLIDAY DETECTION ===== ↓

      // Check 1: Null/NaN/Invalid prices
      const invalidPrices = symbols.filter(symbol => {
        const price = stockPrices[symbol];
        return price === null || price === undefined || isNaN(price) || price <= 0;
      });

      if (invalidPrices.length > 0) {
        console.log(`⏭️ Skipping ${dateStr} - ${invalidPrices.length}/${symbols.length} stocks have invalid prices (holiday/error)`);
        invalidPrices.forEach(symbol => {
          console.log(`   ❌ ${symbol}: ${stockPrices[symbol]}`);
        });
        daysSkipped++;
        continue;
      }

      // Get yesterday's snapshot for comparison
      const yesterdaySnapshot = await DailyReport.findOne({
        userId,
        date: { $lt: currentDate }
      }).sort({ date: -1 });

      if (yesterdaySnapshot && yesterdaySnapshot.stockPerformance) {
        // Check 2: All prices exactly the same (stale data)
        let unchangedCount = 0;
        let comparedCount = 0;
        
        symbols.forEach(symbol => {
          const todayPrice = stockPrices[symbol];
          const yesterdayStock = yesterdaySnapshot.stockPerformance.find(
            s => s.symbol === symbol + '.NS' || s.symbol === symbol
          );
          
          if (yesterdayStock && yesterdayStock.currentPrice > 0) {
            comparedCount++;
            if (Math.abs(todayPrice - yesterdayStock.currentPrice) < 0.01) {
              unchangedCount++;
            }
          }
        });
        
        // If ALL comparable stocks are unchanged, it's suspicious
        if (comparedCount > 0 && unchangedCount === comparedCount) {
          console.log(`⏭️ Skipping ${dateStr} - All ${unchangedCount} stocks unchanged (stale data/holiday)`);
          daysSkipped++;
          continue;
        }
        
        // Check 3: Impossible price changes (>50% for any stock)
        let suspiciousCount = 0;
        
        symbols.forEach(symbol => {
          const todayPrice = stockPrices[symbol];
          const yesterdayStock = yesterdaySnapshot.stockPerformance.find(
            s => s.symbol === symbol + '.NS' || s.symbol === symbol
          );
          
          if (yesterdayStock && yesterdayStock.currentPrice > 0) {
            const changePercent = Math.abs((todayPrice - yesterdayStock.currentPrice) / yesterdayStock.currentPrice) * 100;
            
            if (changePercent > 50) {
              console.warn(`⚠️ ${symbol}: ${yesterdayStock.currentPrice} → ${todayPrice} (${changePercent.toFixed(1)}% change!)`);
              suspiciousCount++;
            }
          }
        });
        
        if (suspiciousCount > 0) {
          console.log(`⏭️ Skipping ${dateStr} - ${suspiciousCount} stocks have impossible changes (>50%)`);
          daysSkipped++;
          continue;
        }
      }

      // ===== END HOLIDAY DETECTION ===== ↑

      // Calculate portfolio value
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

      // ===== CORRECTED METRICS CALCULATIONS ===== ↓

      // Calculate per-stock performance FIRST
      const stockPerformance = calculateStockPerformance(
        activeInvestments,
        stockPrices,
        yesterdaySnapshot?.stockPerformance,
        totalValue
      );

      // Calculate daily changes FROM stock performance (✅ cash-flow free)
      const dailyChanges = calculateDailyChanges(stockPerformance);

      // Calculate drawdown using return % (✅ cash-flow free)
      const previousPeakReturn = yesterdaySnapshot?.peakReturn || null;
      const drawdown = calculateDrawdown(totalValue, totalInvested, previousPeakReturn);

      // Get NIFTY data
      const niftyRecord = await MarketBenchmark.findOne({ date: dateStr });

      // Additional NIFTY validation
      if (!niftyRecord || !niftyRecord.nifty50) {
        console.log(`⏭️ Skipping ${dateStr} - No NIFTY data (market closed)`);
        daysSkipped++;
        continue;
      }

      const benchmarkData = calculateBenchmarkComparison(
        dailyChanges.dailyReturn,
        niftyRecord?.nifty50Change || 0,
        niftyRecord?.nifty50 || null
      );

      // ===== END CORRECTED METRICS ===== ↑

      // Calculate existing metrics
      const daysSinceStart = Math.floor((currentDate - firstBuyDate) / (1000 * 60 * 60 * 24));
      const cagr = calculateCAGR(totalInvested, totalValue, daysSinceStart);

      // Calculate XIRR
      let xirrValue = null;
      if (daysSinceStart >= 7) {
        xirrValue = calculateXIRR(activeInvestments, totalValue, currentDate);
        
        if ((i + 1) % 50 === 0 || i === tradingDays.length - 1) {
          console.log(`📊 XIRR for ${dateStr}: ${xirrValue !== null ? xirrValue + '%' : 'null'}`);
        }
      }

      // Create snapshot with ALL corrected metrics
      await DailyReport.create({
        userId,
        date: currentDate,
        totalInvested,
        portfolioValue: totalValue,
        profitLoss: totalValue - totalInvested,
        roi: ((totalValue - totalInvested) / totalInvested) * 100,
        cagr,
        xirr: xirrValue,
        absoluteReturn: totalValue - totalInvested,
        totalHoldings: activeInvestments.length,
        
        // ✅ CORRECTED FIELDS (cash-flow free)
        dailyReturn: dailyChanges.dailyReturn,
        dailyProfitLoss: dailyChanges.dailyProfitLoss,
        peakReturn: drawdown.peakReturn,
        currentDrawdown: drawdown.currentDrawdown,
        benchmarkComparison: benchmarkData,
        stockPerformance
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
        console.log(`⏳ Progress: ${i + 1}/${tradingDays.length} days (${snapshotsCreated} created, ${daysSkipped} skipped)`);
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
    console.log(`✅ Batch processing complete! Created ${snapshotsCreated} snapshots (${daysSkipped} days skipped as holidays/errors)`);

    return {
      success: true,
      snapshotsCreated,
      daysSkipped,
      tradingDaysProcessed: tradingDays.length,
      actualTradingDays: snapshotsCreated,
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
