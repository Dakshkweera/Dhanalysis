
import xirr from 'xirr';

export const calculateXIRR = (investments, currentPortfolioValue, asOfDate = new Date()) => {
  try {
    if (!investments || investments.length === 0) {
      return null;
    }

    // Check if portfolio has any value
    if (currentPortfolioValue <= 0) {
      return null;
    }

    const transactions = [];

    // Add all investments as negative cash flows
    investments.forEach(inv => {
      transactions.push({
        amount: -(inv.buyPrice * inv.quantity),
        when: new Date(inv.buyDate)
      });
    });

    // ✅ CRITICAL FIX: Use asOfDate instead of new Date()
    transactions.push({
      amount: currentPortfolioValue,
      when: new Date(asOfDate)  // ← Use the snapshot date!
    });

    // ✅ CRITICAL FIX: Calculate days from asOfDate
    const firstDate = new Date(investments[0].buyDate);
    const daysDiff = (new Date(asOfDate) - firstDate) / (1000 * 60 * 60 * 24);
    
    if (daysDiff < 7) {
      return null;
    }

    // Try to calculate XIRR
    const xirrValue = xirr(transactions);
    
    // Check if result is valid
    if (!isFinite(xirrValue)) {
      return null;
    }

    // Cap extreme values
    const xirrPercent = xirrValue * 100;
    
    if (xirrPercent < -99) {
      return -99.99;
    }
    if (xirrPercent > 999) {
      return 999.99;
    }

    return parseFloat(xirrPercent.toFixed(2));

  } catch (error) {
    return null;
  }
};
