import Investment from '../models/Investment.js';
import DailyReport from '../models/DailyReport.js';
import MarketBenchmark from '../models/MarketBenchmark.js';
import User from '../models/User.js';
import { ensureNiftyDataExists } from '../utils/niftyBackfill.js';
import { fetchMultipleStockPrices } from '../utils/historicalPrices.js';

/**
 * Generate trading days between two dates (skip weekends)
 */
const getTradingDays = (startDate, endDate) => {
  const days = [];
  const current = new Date(startDate);
  const end = new Date(endDate);

  while (current <= end) {
    const dayOfWeek = current.getDay();
    // Skip weekends (0 = Sunday, 6 = Saturday)
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      days.push(new Date(current));
    }
    current.setDate(current.getDate() + 1);
  }

  return days;
};

/**
 * Main batch processing function
 */
export const generateHistoricalSnapshots = async (userId) => {
  try {
    console.log(`Starting batch snapshot generation for user ${userId}`);

    // Step 1: Get all user investments, sorted by buyDate
    const investments = await Investment.find({ userId }).sort({ buyDate: 1 });

    if (investments.length === 0) {
      return { success: false, message: 'No investments found' };
    }

    // Step 2: Find earliest buyDate
    const firstInvestment = investments[0];
    const firstBuyDate = new Date(firstInvestment.buyDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    console.log(`Date range: ${firstBuyDate.toISOString().split('T')[0]} to ${today.toISOString().split('T')[0]}`);

    // Step 3: Update user's firstInvestmentDate
    await User.findOneAndUpdate(
      { uid: userId },
      { firstInvestmentDate: firstBuyDate }
    );

    // Step 4: Ensure NIFTY data exists for this range
    console.log('Checking NIFTY data availability...');
    await ensureNiftyDataExists(firstBuyDate, today);

    // Step 5: Get trading days in range
    const tradingDays = getTradingDays(firstBuyDate, today);
    console.log(`Processing ${tradingDays.length} trading days`);

    let snapshotsCreated = 0;
    let apiCallCount = 0;

    // Step 6: Generate snapshots day by day
    for (let i = 0; i < tradingDays.length; i++) {
      const currentDate = tradingDays[i];
      const dateStr = currentDate.toISOString().split('T')[0];

      // Check if snapshot already exists
      const existingSnapshot = await DailyReport.findOne({
        userId,
        date: dateStr
      });

      if (existingSnapshot) {
        console.log(`Snapshot already exists for ${dateStr}, skipping`);
        continue;
      }

      // Get investments that existed on this date
      const activeInvestments = investments.filter(inv => {
        const invDate = new Date(inv.buyDate);
        return invDate <= currentDate;
      });

      if (activeInvestments.length === 0) {
        continue; // No investments yet on this date
      }

      // Fetch stock prices for all active investments
      const symbols = [...new Set(activeInvestments.map(inv => inv.symbol))];
      const stockPrices = await fetchMultipleStockPrices(symbols, dateStr);
      apiCallCount += symbols.length;

      // Calculate portfolio for this date
      let totalInvested = 0;
      let totalValue = 0;

      for (const investment of activeInvestments) {
        const currentPrice = stockPrices[investment.symbol];
        
        if (currentPrice) {
          totalInvested += investment.quantity * investment.buyPrice;
          totalValue += investment.quantity * currentPrice;
        }
      }

      // Get NIFTY data from MarketBenchmark (no API call!)
      const niftyRecord = await MarketBenchmark.findOne({ date: dateStr });
      const nifty50Value = niftyRecord ? niftyRecord.nifty50 : null;

      // Create snapshot (minimal fields for historical data)
      if (totalInvested > 0) {
        await DailyReport.create({
          userId,
          date: dateStr,
          totalInvested,
          portfolioValue: totalValue,
          profitLoss: totalValue - totalInvested,
          roi: ((totalValue - totalInvested) / totalInvested) * 100,
          cagr: 0,  // Set to 0 for historical data, can calculate later
          xirr: null,  // Not calculated for backfill
          absoluteReturn: totalValue - totalInvested,
          totalHoldings: activeInvestments.length,
          benchmarkComparison: {
            nifty50Value: nifty50Value
          }
          // dailyChange and topPerformers left as defaults/undefined
        });

        snapshotsCreated++;
      }

      // Rate limit handling: Pause after ~750 API calls (3 years)
      if (apiCallCount >= 750) {
        console.log(`Pausing after ${apiCallCount} API calls to avoid rate limits...`);
        await new Promise(resolve => setTimeout(resolve, 60000)); // 1 minute pause
        apiCallCount = 0;
      }

      // Progress logging
      if ((i + 1) % 50 === 0) {
        console.log(`Progress: ${i + 1}/${tradingDays.length} days processed`);
      }
    }

    console.log(`Batch processing complete! Created ${snapshotsCreated} snapshots`);

    return {
      success: true,
      snapshotsCreated,
      dateRange: {
        from: firstBuyDate.toISOString().split('T')[0],
        to: today.toISOString().split('T')[0]
      }
    };

  } catch (error) {
    console.error('Batch snapshot generation error:', error);
    throw error;
  }
};
