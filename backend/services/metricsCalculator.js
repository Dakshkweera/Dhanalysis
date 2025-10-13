// backend/services/metricsCalculator.js

/**
 * Helper functions for calculating portfolio metrics
 * ✅ CORRECTED: All functions now cash-flow-free
 */

/**
 * Calculate daily return from stock price movements (cash-flow free)
 * Uses stock performance data to calculate weighted portfolio return
 */
export const calculateDailyChanges = (stockPerformanceData) => {
  if (!stockPerformanceData || stockPerformanceData.length === 0) {
    return {
      dailyReturn: 0,
      dailyProfitLoss: 0
    };
  }

  let totalWeightedReturn = 0;
  let totalWeight = 0;
  let totalDayChange = 0;

  // Calculate weighted average of all stock returns
  for (const stock of stockPerformanceData) {
    // Only include stocks that have yesterday's data (skip newly added stocks)
    if (stock.dayChange !== 0 || stock.previousPrice !== stock.currentPrice) {
      const weight = stock.value;
      totalWeightedReturn += (stock.dayChange / 100) * weight;
      totalWeight += weight;
      totalDayChange += stock.dayChangeAmount;
    }
  }

  // Calculate portfolio daily return
  const dailyReturn = totalWeight > 0 
    ? (totalWeightedReturn / totalWeight) * 100 
    : 0;

  return {
    dailyReturn: parseFloat(dailyReturn.toFixed(2)),
    dailyProfitLoss: parseFloat(totalDayChange.toFixed(2))
  };
};

/**
 * Calculate drawdown from peak RETURN % (not peak value)
 * This makes drawdown independent of capital additions
 */
export const calculateDrawdown = (currentValue, totalInvested, previousPeakReturn = null) => {
  if (!totalInvested || totalInvested === 0) {
    return {
      peakReturn: previousPeakReturn || 0,  // ✅ PRESERVE previous peak!
      currentDrawdown: 0
    };
  }

  const currentReturn = ((currentValue - totalInvested) / totalInvested) * 100;

  // ✅ FIX: Properly handle null/undefined
  let peakReturn;
  if (previousPeakReturn !== null && previousPeakReturn !== undefined && !isNaN(previousPeakReturn)) {
    peakReturn = Math.max(previousPeakReturn, currentReturn);
  } else {
    // First day or missing data - use current return
    peakReturn = currentReturn;
  }

  const drawdown = currentReturn - peakReturn;

  return {
    peakReturn: parseFloat(peakReturn.toFixed(2)),
    currentDrawdown: parseFloat(drawdown.toFixed(2))
  };
};


/**
 * Calculate benchmark comparison with NIFTY
 */
export const calculateBenchmarkComparison = (dailyReturn, niftyDailyReturn, niftyValue) => {
  const niftyReturn = niftyDailyReturn || 0;
  const beatNifty = dailyReturn > niftyReturn;
  const outperformance = parseFloat((dailyReturn - niftyReturn).toFixed(2));
  
  return {
    nifty50Value: niftyValue,
    niftyDailyReturn: parseFloat(niftyReturn.toFixed(2)),
    beatNifty,
    outperformance
  };
};

/**
 * Calculate per-stock performance
 * ✅ Already correct - calculates stock-by-stock movements
 */
export const calculateStockPerformance = (investments, todayPrices, yesterdayStockData, portfolioValue) => {
  return investments.map(investment => {
    const todayPrice = todayPrices[investment.symbol] || investment.buyPrice;
    
    // Get yesterday's price from previous snapshot or use today's price as fallback
    const yesterdayPrice = yesterdayStockData
      ? yesterdayStockData.find(s => s.symbol === investment.symbol)?.currentPrice
      : todayPrice;
    
    const value = investment.quantity * todayPrice;
    const dayChange = yesterdayPrice && yesterdayPrice > 0
      ? ((todayPrice - yesterdayPrice) / yesterdayPrice) * 100
      : 0;
    const dayChangeAmount = yesterdayPrice
      ? investment.quantity * (todayPrice - yesterdayPrice)
      : 0;
    const weight = portfolioValue > 0 ? (value / portfolioValue) * 100 : 0;
    
    return {
      symbol: investment.symbol,
      quantity: investment.quantity,
      currentPrice: parseFloat(todayPrice.toFixed(2)),
      previousPrice: parseFloat((yesterdayPrice || todayPrice).toFixed(2)),
      value: parseFloat(value.toFixed(2)),
      dayChange: parseFloat(dayChange.toFixed(2)),
      dayChangeAmount: parseFloat(dayChangeAmount.toFixed(2)),
      weight: parseFloat(weight.toFixed(2))
    };
  });
};

/**
 * Calculate CAGR
 * ✅ Already correct
 */
export const calculateCAGR = (initialValue, finalValue, days) => {
  if (initialValue <= 0 || finalValue <= 0 || days <= 0) return 0;
  const years = days / 365;
  if (years < 0.02) return 0; // Less than ~7 days
  const cagr = (Math.pow(finalValue / initialValue, 1 / years) - 1) * 100;
  if (cagr < -99) return -99.99;
  if (cagr > 999) return 999.99;
  return parseFloat(cagr.toFixed(2));
};
