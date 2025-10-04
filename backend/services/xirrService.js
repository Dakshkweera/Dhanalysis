import xirr from 'xirr';

export const calculateXIRR = (investments, currentPortfolioValue) => {
  try {
    if (!investments || investments.length === 0) {
      return null;
    }

    // Check if portfolio has any value
    if (currentPortfolioValue <= 0) {
      return null; // Can't calculate XIRR for zero/negative portfolio
    }

    const transactions = [];

    // Add all investments as negative cash flows
    investments.forEach(inv => {
      transactions.push({
        amount: -(inv.buyPrice * inv.quantity),
        when: new Date(inv.buyDate)
      });
    });

    // Add current value as positive cash flow
    transactions.push({
      amount: currentPortfolioValue,
      when: new Date()
    });

    // Check if time period is too short (less than 7 days)
    const firstDate = new Date(investments[0].buyDate);
    const daysDiff = (new Date() - firstDate) / (1000 * 60 * 60 * 24);
    
    if (daysDiff < 7) {
      console.log("⚠️ Time period too short for XIRR (< 7 days)");
      return null;
    }

    // Try to calculate XIRR
    const xirrValue = xirr(transactions);
    
    // Check if result is valid (not NaN, not Infinity)
    if (!isFinite(xirrValue)) {
      console.log("⚠️ XIRR calculation resulted in invalid value");
      return null;
    }

    // Cap extreme values (between -99% and +999%)
    const xirrPercent = xirrValue * 100;
    
    if (xirrPercent < -99) {
      return -99.99; // Cap at -99.99%
    }
    if (xirrPercent > 999) {
      return 999.99; // Cap at +999.99%
    }

    return parseFloat(xirrPercent.toFixed(2));

  } catch (error) {
    // Newton-Raphson convergence failure or other errors
    console.log(`⚠️ XIRR calculation failed: ${error.message}`);
    
    // Return null instead of crashing
    return null;
  }
};
