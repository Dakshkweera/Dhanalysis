// backend/services/analyticsService.js

import DailyReport from '../models/DailyReport.js';

/**
 * Calculate rolling metrics (volatility, Sharpe ratio, etc.) for a given period
 * FULLY CORRECTED: All cash-flow illusions removed
 */
export const calculateRollingMetrics = async (userId, days = 30, asOfDate = new Date()) => {
  try {
    const endDate = new Date(asOfDate);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - days);
    
    console.log(`📊 Calculating ${days}-day rolling metrics from ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
    
    const snapshots = await DailyReport.find({
      userId,
      date: { $gte: startDate, $lte: endDate }
    }).sort({ date: 1 });
    
    if (snapshots.length === 0) {
      return {
        success: false,
        message: `No data available for ${days}-day period`
      };
    }
    
    if (snapshots.length < 7) {
      return {
        success: false,
        message: `Insufficient data. Need at least 7 days, found ${snapshots.length}`
      };
    }
    
    // ===== CALCULATE CASH-FLOW-FREE DAILY RETURNS ===== ↓
    
    const dailyReturns = [];
    
    for (let i = 1; i < snapshots.length; i++) {
      const prevSnap = snapshots[i - 1];
      const currSnap = snapshots[i];
      
      if (!prevSnap.stockPerformance || !currSnap.stockPerformance) continue;
      
      let weightedReturn = 0;
      let totalWeight = 0;
      
      // Calculate portfolio return from stock price movements only
      currSnap.stockPerformance.forEach(currStock => {
        const prevStock = prevSnap.stockPerformance.find(s => s.symbol === currStock.symbol);
        
        // Only use stocks present in both snapshots (skip newly added)
        if (prevStock && prevStock.currentPrice > 0 && currStock.currentPrice > 0) {
          const stockReturn = (currStock.currentPrice - prevStock.currentPrice) / prevStock.currentPrice;
          const weight = currStock.value || 0;
          
          weightedReturn += stockReturn * weight;
          totalWeight += weight;
        }
      });
      
      if (totalWeight > 0) {
        const portfolioReturn = (weightedReturn / totalWeight) * 100;
        dailyReturns.push(portfolioReturn);
      }
    }
    
    if (dailyReturns.length === 0) {
      return {
        success: false,
        message: 'No valid daily returns found'
      };
    }
    
    // ===== CALCULATE METRICS ===== ↓
    
    // 1. Average daily return
    const avgDailyReturn = dailyReturns.reduce((sum, r) => sum + r, 0) / dailyReturns.length;
    
    // 2. Volatility (standard deviation)
    const variance = dailyReturns.reduce((sum, r) => sum + Math.pow(r - avgDailyReturn, 2), 0) / dailyReturns.length;
    const dailyStdDev = Math.sqrt(variance);
    const annualizedVolatility = dailyStdDev * Math.sqrt(252);
    
    // 3. Annualized return
    const annualizedReturn = avgDailyReturn * 252;
    
    // 4. Sharpe Ratio
    const riskFreeRate = 4.0;
    const sharpeRatio = annualizedVolatility > 0 
      ? (annualizedReturn - riskFreeRate) / annualizedVolatility 
      : 0;
    
    // 5. Return-based Max Drawdown
    let peakReturn = -Infinity;
    let maxDrawdown = 0;
    
    snapshots.forEach(snap => {
      const totalInvested = snap.totalInvested || 1;
      const portfolioValue = snap.portfolioValue || 0;
      const currentReturn = ((portfolioValue - totalInvested) / totalInvested) * 100;
      
      if (currentReturn > peakReturn) {
        peakReturn = currentReturn;
      }
      
      const drawdown = currentReturn - peakReturn;
      if (drawdown < maxDrawdown) {
        maxDrawdown = drawdown;
      }
    });
    
    // 6. Win rate
    const positiveDays = dailyReturns.filter(r => r > 0).length;
    const winRate = (positiveDays / dailyReturns.length) * 100;
    
    // 7. Average gain/loss
    const gains = dailyReturns.filter(r => r > 0);
    const losses = dailyReturns.filter(r => r < 0);
    const avgGain = gains.length > 0 ? gains.reduce((sum, r) => sum + r, 0) / gains.length : 0;
    const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((sum, r) => sum + r, 0) / losses.length) : 0;
    
    // 8. Profit factor
    const profitFactor = avgLoss > 0 ? avgGain / avgLoss : 0;
    
    // 9. Total Return (Time-Weighted) - CORRECTED ✅
    // Use geometric mean of daily returns (compounds them correctly)
    let cumulativeReturn = 1.0;
    
    for (const dailyReturn of dailyReturns) {
      cumulativeReturn *= (1 + dailyReturn / 100);
    }
    
    const totalReturn = (cumulativeReturn - 1) * 100;
    
    // 10. Best and worst day
    const bestDay = dailyReturns.length > 0 ? Math.max(...dailyReturns) : 0;
    const worstDay = dailyReturns.length > 0 ? Math.min(...dailyReturns) : 0;
    
    // ===== RETURN METRICS ===== ↓
    
    return {
      success: true,
      period: `${days}d`,
      dataPoints: snapshots.length,
      dateRange: {
        from: snapshots[0].date,
        to: snapshots[snapshots.length - 1].date
      },
      returns: {
        avgDailyReturn: parseFloat(avgDailyReturn.toFixed(4)),
        annualizedReturn: parseFloat(annualizedReturn.toFixed(2)),
        totalReturn: parseFloat(totalReturn.toFixed(2)), // ✅ Now cash-flow-free
        bestDay: parseFloat(bestDay.toFixed(2)),
        worstDay: parseFloat(worstDay.toFixed(2))
      },
      risk: {
        dailyVolatility: parseFloat(dailyStdDev.toFixed(4)),
        annualizedVolatility: parseFloat(annualizedVolatility.toFixed(2)),
        maxDrawdown: parseFloat(maxDrawdown.toFixed(2)),
        sharpeRatio: parseFloat(sharpeRatio.toFixed(2))
      },
      performance: {
        winRate: parseFloat(winRate.toFixed(2)),
        positiveDays,
        negativeDays: dailyReturns.length - positiveDays,
        avgGain: parseFloat(avgGain.toFixed(2)),
        avgLoss: parseFloat(avgLoss.toFixed(2)),
        profitFactor: parseFloat(profitFactor.toFixed(2))
      }
    };
    
  } catch (error) {
    console.error('❌ Error calculating rolling metrics:', error);
    throw error;
  }
};

/**
 * Calculate correlation with NIFTY
 */
export const calculateCorrelationWithNifty = async (userId, days = 30) => {
  try {
    const endDate = new Date();
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - days);
    
    const snapshots = await DailyReport.find({
      userId,
      date: { $gte: startDate, $lte: endDate }
    }).sort({ date: 1 });
    
    if (snapshots.length < 10) {
      return { success: false, message: 'Insufficient data for correlation' };
    }
    
    const data = [];
    
    for (let i = 1; i < snapshots.length; i++) {
      const prevSnap = snapshots[i - 1];
      const currSnap = snapshots[i];
      
      const niftyReturn = currSnap.benchmarkComparison?.niftyDailyReturn;
      if (niftyReturn === null || niftyReturn === undefined) continue;
      
      if (!prevSnap.stockPerformance || !currSnap.stockPerformance) continue;
      
      let weightedReturn = 0;
      let totalWeight = 0;
      
      currSnap.stockPerformance.forEach(currStock => {
        const prevStock = prevSnap.stockPerformance.find(s => s.symbol === currStock.symbol);
        
        if (prevStock && prevStock.currentPrice > 0 && currStock.currentPrice > 0) {
          const stockReturn = (currStock.currentPrice - prevStock.currentPrice) / prevStock.currentPrice;
          const weight = currStock.value || 0;
          
          weightedReturn += stockReturn * weight;
          totalWeight += weight;
        }
      });
      
      if (totalWeight > 0) {
        const portfolioReturn = (weightedReturn / totalWeight) * 100;
        data.push({ portfolioReturn, niftyReturn });
      }
    }
    
    if (data.length < 10) {
      return { success: false, message: 'Insufficient matching data' };
    }
    
    const n = data.length;
    const portfolioReturns = data.map(d => d.portfolioReturn);
    const niftyReturns = data.map(d => d.niftyReturn);
    
    const portfolioMean = portfolioReturns.reduce((sum, r) => sum + r, 0) / n;
    const niftyMean = niftyReturns.reduce((sum, r) => sum + r, 0) / n;
    
    let numerator = 0;
    let portfolioSumSq = 0;
    let niftySumSq = 0;
    
    for (let i = 0; i < n; i++) {
      const portfolioDiff = portfolioReturns[i] - portfolioMean;
      const niftyDiff = niftyReturns[i] - niftyMean;
      
      numerator += portfolioDiff * niftyDiff;
      portfolioSumSq += portfolioDiff * portfolioDiff;
      niftySumSq += niftyDiff * niftyDiff;
    }
    
    const denominator = Math.sqrt(portfolioSumSq * niftySumSq);
    const correlation = denominator > 0 ? numerator / denominator : 0;
    
    const portfolioStdDev = Math.sqrt(portfolioSumSq / n);
    const niftyStdDev = Math.sqrt(niftySumSq / n);
    const beta = niftyStdDev > 0 ? (correlation * portfolioStdDev) / niftyStdDev : 1;
    
    return {
      success: true,
      correlation: parseFloat(correlation.toFixed(3)),
      beta: parseFloat(beta.toFixed(2)),
      interpretation: getCorrelationInterpretation(correlation)
    };
    
  } catch (error) {
    console.error('❌ Error calculating correlation:', error);
    throw error;
  }
};

const getCorrelationInterpretation = (correlation) => {
  const absCorr = Math.abs(correlation);
  
  if (absCorr >= 0.8) return 'Very strong correlation';
  if (absCorr >= 0.6) return 'Strong correlation';
  if (absCorr >= 0.4) return 'Moderate correlation';
  if (absCorr >= 0.2) return 'Weak correlation';
  return 'Very weak or no correlation';
};
