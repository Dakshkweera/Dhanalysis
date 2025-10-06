// Helper: Calculate CAGR
export const calculateCAGR = (investedAmount, currentValue, firstInvestmentDate) => {
  const now = new Date();
  const startDate = new Date(firstInvestmentDate);
  
  // Calculate years (including fractional years)
  const daysDiff = (now - startDate) / (1000 * 60 * 60 * 24);
  const years = daysDiff / 365.25;
  
  if (years <= 0 || investedAmount <= 0) {
    return { cagr: 0, cagrNote: null, absoluteReturn: 0, holdingPeriodDays: 0 };
  }
  
  // Absolute return percentage
  const absoluteReturn = ((currentValue - investedAmount) / investedAmount) * 100;
  
  // CAGR formula: [(Current/Invested)^(1/years)] - 1
  const cagr = (Math.pow(currentValue / investedAmount, 1 / years) - 1) * 100;
  
  // Generate note if holding period < 1 year
  let cagrNote = null;
  if (years < 1) {
    const months = Math.floor((daysDiff / 365.25) * 12);
    cagrNote = `Annualized estimate (holding period: ${months} month${months !== 1 ? 's' : ''})`;
  }
  
  return {
    cagr: parseFloat(cagr.toFixed(2)),
    cagrNote,
    absoluteReturn: parseFloat(absoluteReturn.toFixed(2)),
    holdingPeriodDays: Math.floor(daysDiff)
  };
};



// Helper: Find best and worst performers
export const findTopPerformers = (investments, priceMap) => {
  if (investments.length === 0) {
    return { best: null, worst: null };
  }
  
  // Calculate ROI for each investment
  const investmentsWithROI = investments.map(inv => {
    const currentPrice = priceMap[inv.symbol] || 0;
    const investedAmount = inv.quantity * inv.buyPrice;
    const currentValue = inv.quantity * currentPrice;
    const profitLoss = currentValue - investedAmount;
    const roi = investedAmount > 0 ? (profitLoss / investedAmount) * 100 : 0;
    
    return {
      symbol: inv.symbol,
      roi: parseFloat(roi.toFixed(2)),
      profitLoss: parseFloat(profitLoss.toFixed(2))
    };
  });
  
  // Sort by ROI
  const sortedByROI = [...investmentsWithROI].sort((a, b) => b.roi - a.roi);
  
  return {
    best: sortedByROI[0],
    worst: sortedByROI[sortedByROI.length - 1]
  };
};



// Main: Calculate complete portfolio metrics
export const calculatePortfolioMetrics = (investments, priceMap, firstInvestmentDate) => {
  if (investments.length === 0) {
    return {
      totalInvested: 0,
      currentValue: 0,
      profitLoss: 0,
      roi: 0,
      absoluteReturn: 0,
      cagr: 0,
      cagrNote: null,
      holdingPeriodDays: 0,
      totalHoldings: 0
    };
  }
  
  let totalInvested = 0;
  let currentValue = 0;
  
  // Calculate totals
  investments.forEach(inv => {
    const currentPrice = priceMap[inv.symbol] || 0;
    const invested = inv.quantity * inv.buyPrice;
    const current = inv.quantity * currentPrice;
    
    totalInvested += invested;
    currentValue += current;
  });
  
  const profitLoss = currentValue - totalInvested;
  const roi = totalInvested > 0 ? (profitLoss / totalInvested) * 100 : 0;
  
  // Calculate CAGR
  const cagrData = calculateCAGR(totalInvested, currentValue, firstInvestmentDate);
  
  // Get unique symbol count
  const uniqueSymbols = [...new Set(investments.map(inv => inv.symbol))];
  
  return {
    totalInvested: parseFloat(totalInvested.toFixed(2)),
    currentValue: parseFloat(currentValue.toFixed(2)),
    profitLoss: parseFloat(profitLoss.toFixed(2)),
    roi: parseFloat(roi.toFixed(2)),
    absoluteReturn: cagrData.absoluteReturn,
    cagr: cagrData.cagr,
    cagrNote: cagrData.cagrNote,
    holdingPeriodDays: cagrData.holdingPeriodDays,
    totalHoldings: uniqueSymbols.length
  };
};