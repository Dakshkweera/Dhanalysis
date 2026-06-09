// backend/services/analyticsService.js
// Advanced risk analytics — reads from stored DailyReport snapshots in MongoDB.
// All calculations are cash-flow-free (price movements only, not capital additions).

import DailyReport from '../models/DailyReport.js';
import { TRADING_DAYS_PER_YEAR, RISK_FREE_RATE, MIN_DAYS_FOR_ANALYTICS } from '../config/constants.js';

/**
 * calculateRollingMetrics
 * -----------------------
 * Answers: "How risky is this portfolio, and is the return worth the risk?"
 *
 * Reads the last N days of DailyReport snapshots and computes:
 *
 * VOLATILITY (annualised std deviation of daily returns)
 *   How wildly does the portfolio swing day to day?
 *   High = big swings. Low = stable.
 *   We annualise by multiplying by √252 (252 trading days/year).
 *
 * SHARPE RATIO = (annualised return - risk-free rate) / annualised volatility
 *   The most important risk metric: return per unit of risk.
 *   > 1.0 = good. > 1.5 = great. < 0 = you'd have been better off in FD.
 *   Risk-free rate = ~4% (Indian T-bill rate) — what you'd earn with zero risk.
 *
 * MAX DRAWDOWN
 *   Worst peak-to-trough decline in the period.
 *   e.g. portfolio was +20% in March, then fell to +5% in June → drawdown = -15%
 *
 * WIN RATE
 *   % of days the portfolio went up. 50%+ is generally good.
 *
 * PROFIT FACTOR = avgGain / avgLoss
 *   If you gain 2% on up days and lose 1% on down days → profit factor 2.0 (great)
 *
 * @param days - rolling window in calendar days (default 30)
 * @param asOfDate - calculate as of this date (default today)
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
    
    if (snapshots.length < MIN_DAYS_FOR_ANALYTICS) {
      return {
        success: false,
        message: `Insufficient data. Need at least ${MIN_DAYS_FOR_ANALYTICS} days, found ${snapshots.length}`
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
    
    // 1. Average daily return — simple mean of all daily % returns
    const avgDailyReturn = dailyReturns.reduce((sum, r) => sum + r, 0) / dailyReturns.length;

    // 2. Volatility — how spread out the returns are (standard deviation)
    //    High variance = big swings both up and down = risky portfolio
    //    dailyStdDev × √252 = annualised volatility (252 = trading days/year)
    const variance = dailyReturns.reduce((sum, r) => sum + Math.pow(r - avgDailyReturn, 2), 0) / dailyReturns.length;
    const dailyStdDev = Math.sqrt(variance);
    const annualizedVolatility = dailyStdDev * Math.sqrt(TRADING_DAYS_PER_YEAR);

    // 3. Annualised return — scale daily average to a full year
    //    (simple scaling, not geometric — slight overestimate for high returns)
    const annualizedReturn = avgDailyReturn * TRADING_DAYS_PER_YEAR;

    // 4. Sharpe Ratio = (return above risk-free rate) / volatility
    //    Answers: "How much EXTRA return am I getting per unit of risk?"
    //    We subtract RISK_FREE_RATE (4%) because a bank FD gives that with zero risk
    //    Sharpe > 1 means you're earning good return for the risk you're taking
    const sharpeRatio = annualizedVolatility > 0
      ? (annualizedReturn - RISK_FREE_RATE) / annualizedVolatility
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
 * calculateCorrelationWithNifty
 * -----------------------------
 * Answers: "Does my portfolio move with the market, against it, or independently?"
 *
 * CORRELATION (Pearson coefficient, -1 to +1):
 *   +1.0 = your portfolio moves exactly with NIFTY (you're basically holding NIFTY)
 *    0.0 = no relationship (your portfolio is uncorrelated to market)
 *   -1.0 = your portfolio moves opposite to NIFTY (perfect hedge)
 *
 * BETA (market sensitivity):
 *   Beta = Cov(portfolio, NIFTY) / Var(NIFTY)
 *   > 1.0 = your portfolio amplifies market moves (aggressive)
 *   < 1.0 = your portfolio dampens market moves (defensive)
 *   1.0   = moves exactly with market
 *   e.g. Beta 1.3: if NIFTY drops 10%, your portfolio drops ~13%
 *
 * We use Pearson correlation formula:
 *   r = Σ((xi - x̄)(yi - ȳ)) / √(Σ(xi-x̄)² × Σ(yi-ȳ)²)
 *   where x = portfolio daily returns, y = NIFTY daily returns
 *
 * Beta = correlation × (stdDev_portfolio / stdDev_nifty)
 *
 * Requires at least 10 data points for statistical relevance.
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
