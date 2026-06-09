// backend/services/xirrService.js
// Calculates XIRR — the most accurate way to measure return when
// investments happen at different times.

import xirr from 'xirr';
import { XIRR_CAP_LOW, XIRR_CAP_HIGH, MIN_DAYS_FOR_XIRR } from '../config/constants.js';

/**
 * calculateXIRR
 * -------------
 * Answers: "Given that I invested different amounts on different dates,
 *           what single annualised return explains all those cash flows?"
 *
 * Why XIRR, not CAGR?
 *   CAGR assumes you invested everything on day 1.
 *   XIRR handles irregular cash flows — you bought 10 RELIANCE in Jan,
 *   then 5 more INFY in June, then 20 WIPRO in October.
 *   Each investment sits for a different duration, so a simple CAGR is wrong.
 *
 * How it works:
 *   - Each purchase = negative cash flow (you gave money away on that date)
 *   - Portfolio value today = positive cash flow (if you sold everything today)
 *   - XIRR finds the interest rate r such that NPV of all cash flows = 0
 *
 * Example:
 *   Jan 1:  -₹10,000 (bought stocks)
 *   Jun 15: -₹5,000  (bought more)
 *   Today:  +₹18,000 (current value — hypothetical "sell")
 *   XIRR solves: 10000/(1+r)^t1 + 5000/(1+r)^t2 = 18000
 *
 * @param investments - array of { buyPrice, quantity, buyDate }
 * @param currentPortfolioValue - total current market value (₹)
 * @param asOfDate - snapshot date (defaults to today; use snapshot date in cron)
 * @returns XIRR as % (e.g. 18.4) or null if insufficient data
 */
export const calculateXIRR = (investments, currentPortfolioValue, asOfDate = new Date()) => {
  try {
    if (!investments || investments.length === 0) return null;
    if (currentPortfolioValue <= 0) return null;

    // Sort oldest first — needed so [0] gives us the correct earliest date
    const sorted = [...investments].sort(
      (a, b) => new Date(a.buyDate) - new Date(b.buyDate)
    );

    // Build cash flow list: every purchase is a negative outflow
    const transactions = sorted.map(inv => ({
      amount: -(inv.buyPrice * inv.quantity), // negative = money leaving your pocket
      when:   new Date(inv.buyDate),
    }));

    // Today's portfolio value = what you'd receive if you sold everything
    // This is the final positive inflow that makes the equation balance
    transactions.push({
      amount: currentPortfolioValue,
      when:   new Date(asOfDate),
    });

    // Need enough history — XIRR on < 7 days is meaningless and unstable
    const firstDate = new Date(sorted[0].buyDate);
    const daysDiff  = (new Date(asOfDate) - firstDate) / (1000 * 60 * 60 * 24);
    if (daysDiff < MIN_DAYS_FOR_XIRR) return null;

    // xirr() returns a decimal (e.g. 0.184 = 18.4%)
    const xirrValue = xirr(transactions);
    if (!isFinite(xirrValue)) return null;

    const xirrPercent = xirrValue * 100;

    // Cap extreme values — return null if beyond reasonable range
    // 999%+ XIRR on a new portfolio is meaningless, not informative
    if (xirrPercent < XIRR_CAP_LOW)  return null;
    if (xirrPercent > XIRR_CAP_HIGH) return null;

    return parseFloat(xirrPercent.toFixed(2));
  } catch {
    // xirr() throws if it can't converge — just return null
    return null;
  }
};
