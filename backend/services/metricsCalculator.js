// backend/services/metricsCalculator.js
// Pure calculation functions — no DB calls, no API calls.
// All functions are "cash-flow-free": adding new money to your portfolio
// doesn't artificially inflate or deflate performance numbers.

import { CAGR_CAP_LOW, CAGR_CAP_HIGH } from '../config/constants.js';

/**
 * calculateDailyChanges
 * --------------------
 * Answers: "How much did the portfolio move TODAY due to market prices only?"
 *
 * Why cash-flow-free matters:
 *   If you bought ₹50,000 of new stocks today, your portfolio "grew" by ₹50,000.
 *   But that's YOUR money added, not the market moving.
 *   This function ignores newly added stocks (no yesterday price = skip).
 *   It only counts price movements on stocks you already held.
 *
 * How it works:
 *   For each stock, weight its return by how much of the portfolio it is.
 *   e.g. RELIANCE is 40% of portfolio and went up 2% → contributes 0.8% to daily return.
 */
export const calculateDailyChanges = (stockPerformanceData) => {
  if (!stockPerformanceData || stockPerformanceData.length === 0) {
    return { dailyReturn: 0, dailyProfitLoss: 0 };
  }

  let totalWeightedReturn = 0;
  let totalWeight = 0;
  let totalDayChange = 0;

  for (const stock of stockPerformanceData) {
    // Skip stocks with no yesterday price — they were just added today
    // Including them would make "buying stock" look like a gain
    if (stock.dayChange !== 0 || stock.previousPrice !== stock.currentPrice) {
      const weight = stock.value; // weight = ₹ value of this stock
      totalWeightedReturn += (stock.dayChange / 100) * weight;
      totalWeight += weight;
      totalDayChange += stock.dayChangeAmount;
    }
  }

  // Weighted average return across all eligible stocks
  const dailyReturn = totalWeight > 0
    ? (totalWeightedReturn / totalWeight) * 100
    : 0;

  return {
    dailyReturn:     parseFloat(dailyReturn.toFixed(2)),
    dailyProfitLoss: parseFloat(totalDayChange.toFixed(2)),
  };
};

/**
 * calculateDrawdown
 * -----------------
 * Answers: "How far below the best return has the portfolio ever fallen?"
 *
 * Drawdown = currentReturn - peakReturn (always 0 or negative)
 * e.g. peak was +20%, now at +15% → drawdown = -5%
 *
 * We measure from RETURN %, not portfolio ₹ value.
 * Why? Because if you add ₹1 lakh new capital today, portfolio value jumps
 * but you haven't actually "recovered" — measuring in % avoids this illusion.
 *
 * We carry forward the previous peak so it accumulates correctly over time.
 */
export const calculateDrawdown = (currentValue, totalInvested, previousPeakReturn = null) => {
  if (!totalInvested || totalInvested === 0) {
    // No investments yet — preserve whatever peak we had before
    return { peakReturn: previousPeakReturn || 0, currentDrawdown: 0 };
  }

  // Today's return as a percentage of total invested
  const currentReturn = ((currentValue - totalInvested) / totalInvested) * 100;

  // Peak is the highest return we've ever seen (carried from yesterday's snapshot)
  let peakReturn;
  if (previousPeakReturn !== null && previousPeakReturn !== undefined && !isNaN(previousPeakReturn)) {
    peakReturn = Math.max(previousPeakReturn, currentReturn); // never decrease the peak
  } else {
    peakReturn = currentReturn; // first day — today IS the peak
  }

  // Drawdown: how far below peak we are right now
  const drawdown = currentReturn - peakReturn; // always ≤ 0

  return {
    peakReturn:      parseFloat(peakReturn.toFixed(2)),
    currentDrawdown: parseFloat(drawdown.toFixed(2)),
  };
};

/**
 * calculateBenchmarkComparison
 * ----------------------------
 * Answers: "Did you beat the NIFTY 50 today?"
 *
 * Compares portfolio's daily return against NIFTY's daily return.
 * outperformance > 0 means you beat the index today.
 * outperformance < 0 means NIFTY did better than your portfolio.
 */
export const calculateBenchmarkComparison = (dailyReturn, niftyDailyReturn, niftyValue) => {
  const niftyReturn   = niftyDailyReturn || 0;
  const beatNifty     = dailyReturn > niftyReturn;
  const outperformance = parseFloat((dailyReturn - niftyReturn).toFixed(2));

  return {
    nifty50Value:     niftyValue,
    niftyDailyReturn: parseFloat(niftyReturn.toFixed(2)),
    beatNifty,
    outperformance,
  };
};

/**
 * calculateStockPerformance
 * -------------------------
 * Builds a per-stock snapshot for the day: today's price, yesterday's price,
 * how much it moved (₹ and %), and what % of the portfolio it is.
 *
 * Called before calculateDailyChanges — this builds the data that function reads.
 *
 * yesterdayStockData comes from the previous DailyReport snapshot in MongoDB.
 * If null (first day), we use today's price as yesterday's → dayChange = 0.
 */
export const calculateStockPerformance = (investments, todayPrices, yesterdayStockData, portfolioValue) => {
  return investments.map(investment => {
    // Use today's fetched price, or fall back to buy price if fetch failed
    const todayPrice = todayPrices[investment.symbol] || investment.buyPrice;

    // Get yesterday's price from last snapshot, or default to today (no change)
    const yesterdayPrice = yesterdayStockData
      ? yesterdayStockData.find(s => s.symbol === investment.symbol)?.currentPrice
      : todayPrice;

    const value           = investment.quantity * todayPrice;

    // Daily % change in price
    const dayChange       = yesterdayPrice && yesterdayPrice > 0
      ? ((todayPrice - yesterdayPrice) / yesterdayPrice) * 100
      : 0;

    // Actual ₹ change for this holding
    const dayChangeAmount = yesterdayPrice
      ? investment.quantity * (todayPrice - yesterdayPrice)
      : 0;

    // What % of the total portfolio does this stock represent?
    const weight          = portfolioValue > 0 ? (value / portfolioValue) * 100 : 0;

    return {
      symbol:          investment.symbol,
      quantity:        investment.quantity,
      buyPrice:        parseFloat((investment.buyPrice || 0).toFixed(2)), // cost basis for per-stock ROI
      currentPrice:    parseFloat(todayPrice.toFixed(2)),
      previousPrice:   parseFloat((yesterdayPrice || todayPrice).toFixed(2)),
      value:           parseFloat(value.toFixed(2)),
      dayChange:       parseFloat(dayChange.toFixed(2)),
      dayChangeAmount: parseFloat(dayChangeAmount.toFixed(2)),
      weight:          parseFloat(weight.toFixed(2)),
    };
  });
};

/**
 * calculateCAGR (standalone — used by batchSnapshotService)
 * ----------------------------------------------------------
 * Compound Annual Growth Rate: what annualised % return did you earn?
 *
 * Formula: (finalValue / initialValue)^(1/years) - 1
 *
 * Example: ₹1,00,000 → ₹1,21,000 in 2 years = CAGR 10%
 *   (1.21)^(1/2) - 1 = 0.10 = 10%
 *
 * Capped at -99.99% and 999.99% to prevent absurd numbers on very short periods.
 */
export const calculateCAGR = (initialValue, finalValue, days) => {
  if (initialValue <= 0 || finalValue <= 0 || days <= 0) return 0;

  const years = days / 365;
  if (years < 0.02) return 0; // Less than ~7 days — not meaningful

  const cagr = (Math.pow(finalValue / initialValue, 1 / years) - 1) * 100;

  if (cagr < CAGR_CAP_LOW)  return CAGR_CAP_LOW;
  if (cagr > CAGR_CAP_HIGH) return CAGR_CAP_HIGH;

  return parseFloat(cagr.toFixed(2));
};
