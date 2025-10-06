import yahooFinance from 'yahoo-finance2';
import MarketBenchmark from '../models/MarketBenchmark.js';

/**
 * Fetch historical NIFTY data for a single date
 */
export const fetchNiftyForDate = async (date) => {
  try {
    const startDate = new Date(date);
    const endDate = new Date(date);
    endDate.setDate(endDate.getDate() + 1);

    const result = await yahooFinance.historical('^NSEI', {
      period1: startDate,
      period2: endDate,
      interval: '1d'
    });

    if (result && result.length > 0) {
      const data = result[0];
      return {
        nifty50: data.close,
        nifty50Change: ((data.close - data.open) / data.open) * 100,
        nifty50ChangeValue: data.close - data.open
      };
    }
    return null;
  } catch (error) {
    console.error(`Error fetching NIFTY for ${date}:`, error.message);
    return null;
  }
};

/**
 * Ensure NIFTY data exists for date range
 * Fills gaps automatically
 */
export const ensureNiftyDataExists = async (startDate, endDate) => {
  try {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const missingDates = [];

    // Check each date
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      const exists = await MarketBenchmark.findOne({ date: dateStr });
      
      if (!exists) {
        missingDates.push(dateStr);
      }
    }

    console.log(`Found ${missingDates.length} missing NIFTY dates`);

    // Fetch missing data
    for (const dateStr of missingDates) {
      const niftyData = await fetchNiftyForDate(dateStr);
      
      if (niftyData) {
        await MarketBenchmark.create({
          date: dateStr,
          ...niftyData
        });
        console.log(`Stored NIFTY data for ${dateStr}`);
      }

      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return { filled: missingDates.length };
  } catch (error) {
    console.error('Error ensuring NIFTY data:', error);
    throw error;
  }
};

