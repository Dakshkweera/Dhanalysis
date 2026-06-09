// backend/services/portfolioService.js
// High-level portfolio calculations — takes raw investments + prices,
// returns summary metrics used by controllers and the AI context builder.

/**
 * calculateCAGR (portfolio version)
 * ----------------------------------
 * Answers: "What is my annualised return since I started investing?"
 *
 * CAGR = Compound Annual Growth Rate.
 * It answers: "If my money grew at a constant rate every year, what was that rate?"
 *
 * Formula: (currentValue / investedAmount)^(1/years) - 1
 *
 * Why CAGR instead of simple ROI?
 *   Simple ROI of 30% over 3 years looks the same as 30% over 1 year.
 *   CAGR normalises for time: 30% over 3 years = 9.1% CAGR, much less impressive.
 *
 * If holding period < 1 year, we still annualise but add a cagrNote warning
 * because annualising very short periods exaggerates the number.
 */
export const calculateCAGR = (investedAmount, currentValue, firstInvestmentDate) => {
  const now       = new Date();
  const startDate = new Date(firstInvestmentDate);

  const daysDiff = (now - startDate) / (1000 * 60 * 60 * 24);
  const years    = daysDiff / 365.25;

  // Simple ROI — always calculated regardless of holding period
  const absoluteReturn = investedAmount > 0
    ? parseFloat(((currentValue - investedAmount) / investedAmount * 100).toFixed(2))
    : 0;

  if (years <= 0 || investedAmount <= 0) {
    return { cagr: null, cagrNote: null, absoluteReturn: 0, holdingPeriodDays: 0 };
  }

  // CAGR is meaningless for very short periods — extrapolates tiny gains to huge %
  // Minimum 30 days before showing CAGR
  if (daysDiff < 30) {
    return {
      cagr:              null,
      cagrNote:          'Available after 30 days',
      absoluteReturn,
      holdingPeriodDays: Math.floor(daysDiff),
    };
  }

  // Annualised return
  const rawCagr = (Math.pow(currentValue / investedAmount, 1 / years) - 1) * 100;

  // Cap to prevent absurd numbers on short periods
  const cagr = Math.min(Math.max(rawCagr, -99), 999.99);

  let cagrNote = null;
  if (years < 1) {
    const months = Math.floor(daysDiff / 30);
    cagrNote = `Annualized estimate (${months} month${months !== 1 ? 's' : ''})`;
  }

  return {
    cagr:              parseFloat(cagr.toFixed(2)),
    cagrNote,
    absoluteReturn,
    holdingPeriodDays: Math.floor(daysDiff),
  };
};

/**
 * findTopPerformers
 * -----------------
 * Answers: "Which stock made me the most money, and which hurt me the most?"
 *
 * Calculates ROI = (currentValue - invested) / invested for each symbol,
 * then returns the best and worst.
 *
 * Note: ROI is calculated per investment record (not per symbol aggregate),
 * so if you bought the same stock twice at different prices, each row counts separately.
 */
export const findTopPerformers = (investments, priceMap) => {
  if (investments.length === 0) return { best: null, worst: null };

  const investmentsWithROI = investments.map(inv => {
    const currentPrice  = priceMap[inv.symbol] || 0;
    const investedAmount = inv.quantity * inv.buyPrice;
    const currentValue  = inv.quantity * currentPrice;
    const profitLoss    = currentValue - investedAmount;

    // ROI = profit as % of what you put in
    const roi = investedAmount > 0 ? (profitLoss / investedAmount) * 100 : 0;

    return {
      symbol:    inv.symbol,
      roi:       parseFloat(roi.toFixed(2)),
      profitLoss: parseFloat(profitLoss.toFixed(2)),
    };
  });

  // Sort descending by ROI — first = best, last = worst
  const sortedByROI = [...investmentsWithROI].sort((a, b) => b.roi - a.roi);

  return {
    best:  sortedByROI[0],
    worst: sortedByROI[sortedByROI.length - 1],
  };
};

/**
 * calculatePortfolioMetrics
 * -------------------------
 * Master summary function — the single source of truth for portfolio numbers.
 *
 * Given a list of investments + today's prices, calculates:
 *   - totalInvested: sum of (quantity × buyPrice) across all investments
 *   - currentValue:  sum of (quantity × currentPrice) across all investments
 *   - profitLoss:    currentValue - totalInvested (can be negative)
 *   - roi:           profitLoss as % of totalInvested (simple, not annualised)
 *   - cagr:          annualised return since first investment
 *   - totalHoldings: number of unique stocks held
 *
 * Called by: portfolioController, aiController, dailySnapshotCron
 */
export const calculatePortfolioMetrics = (investments, priceMap, firstInvestmentDate) => {
  if (investments.length === 0) {
    return {
      totalInvested: 0, currentValue: 0,
      profitLoss: 0, roi: 0,
      absoluteReturn: 0, cagr: 0,
      cagrNote: null, holdingPeriodDays: 0, totalHoldings: 0,
    };
  }

  let totalInvested = 0;
  let currentValue  = 0;

  // Sum up every investment row
  investments.forEach(inv => {
    const currentPrice = priceMap[inv.symbol] || 0;
    totalInvested += inv.quantity * inv.buyPrice;   // what you paid
    currentValue  += inv.quantity * currentPrice;   // what it's worth now
  });

  const profitLoss = currentValue - totalInvested;

  // ROI = simple % gain (not time-adjusted)
  const roi = totalInvested > 0 ? (profitLoss / totalInvested) * 100 : 0;

  // CAGR = time-adjusted % gain (more meaningful for comparing investments)
  const cagrData = calculateCAGR(totalInvested, currentValue, firstInvestmentDate);

  // Count unique symbols — one stock bought 3 times = 1 holding
  const uniqueSymbols = [...new Set(investments.map(inv => inv.symbol))];

  return {
    totalInvested:     parseFloat(totalInvested.toFixed(2)),
    currentValue:      parseFloat(currentValue.toFixed(2)),
    profitLoss:        parseFloat(profitLoss.toFixed(2)),
    roi:               parseFloat(roi.toFixed(2)),
    absoluteReturn:    cagrData.absoluteReturn,
    cagr:              cagrData.cagr,
    cagrNote:          cagrData.cagrNote,
    holdingPeriodDays: cagrData.holdingPeriodDays,
    totalHoldings:     uniqueSymbols.length,
  };
};
