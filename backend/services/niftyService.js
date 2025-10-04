import yahooFinance from 'yahoo-finance2';
import MarketBenchmark from '../models/MarketBenchmark.js';

// Fetch current NIFTY 50 value
export const fetchNiftyValue = async () => {
  try {
    console.log('📊 Fetching NIFTY 50 data from Yahoo Finance...');
    
    const quote = await yahooFinance.quote('^NSEI');
    
    const niftyData = {
      value: quote.regularMarketPrice,
      change: quote.regularMarketChange,
      changePercent: quote.regularMarketChangePercent
    };
    
    console.log('✅ NIFTY 50:', niftyData.value, `(${niftyData.changePercent?.toFixed(2)}%)`);
    
    return niftyData;
    
  } catch (error) {
    console.error('❌ Error fetching NIFTY data:', error.message);
    throw error;
  }
};

// Get or create NIFTY entry for a specific date
export const getNiftyForDate = async (date) => {
  try {
    // Normalize date to midnight UTC
    const normalizedDate = new Date(Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      0, 0, 0, 0
    ));
    
    // Check if entry exists
    let benchmark = await MarketBenchmark.findOne({ date: normalizedDate });
    
    if (benchmark) {
      console.log('✅ Using cached NIFTY for', normalizedDate.toISOString().split('T')[0]);
      return benchmark;
    }
    
    // Fetch and create new entry
    console.log('🔍 Fetching fresh NIFTY data for', normalizedDate.toISOString().split('T')[0]);
    
    const niftyData = await fetchNiftyValue();
    
    benchmark = await MarketBenchmark.create({
      date: normalizedDate,
      nifty50: niftyData.value,
      nifty50Change: niftyData.changePercent || 0,
      nifty50ChangeValue: niftyData.change || 0
    });
    
    console.log('✅ Saved NIFTY benchmark for', normalizedDate.toISOString().split('T')[0]);
    
    return benchmark;
    
  } catch (error) {
    console.error('❌ Error in getNiftyForDate:', error.message);
    throw error;
  }
};

// Calculate NIFTY return between two dates
export const calculateNiftyReturn = async (startDate, endDate) => {
  try {
    const startBenchmark = await MarketBenchmark.findOne({
      date: { $lte: startDate }
    }).sort({ date: -1 }).limit(1);
    
    const endBenchmark = await MarketBenchmark.findOne({
      date: { $lte: endDate }
    }).sort({ date: -1 }).limit(1);
    
    if (!startBenchmark || !endBenchmark) {
      return null;
    }
    
    const niftyReturn = ((endBenchmark.nifty50 - startBenchmark.nifty50) / startBenchmark.nifty50) * 100;
    
    return {
      startValue: startBenchmark.nifty50,
      endValue: endBenchmark.nifty50,
      return: parseFloat(niftyReturn.toFixed(2))
    };
    
  } catch (error) {
    console.error('❌ Error calculating NIFTY return:', error.message);
    return null;
  }
};
