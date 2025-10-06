import yahooFinance from 'yahoo-finance2';

/**
 * Fetch historical stock price for a single date
 */
export const fetchStockPriceForDate = async (symbol, date) => {
  try {
    const startDate = new Date(date);
    const endDate = new Date(date);
    endDate.setDate(endDate.getDate() + 1);

    const result = await yahooFinance.historical(symbol, {
      period1: startDate,
      period2: endDate,
      interval: '1d'
    });

    if (result && result.length > 0) {
      return result[0].close;
    }
    return null;
  } catch (error) {
    console.error(`Error fetching price for ${symbol} on ${date}:`, error.message);
    return null;
  }
};

/**
 * Fetch prices for multiple stocks on same date
 */
export const fetchMultipleStockPrices = async (symbols, date) => {
  const prices = {};
  
  for (const symbol of symbols) {
    prices[symbol] = await fetchStockPriceForDate(symbol, date);
    await new Promise(resolve => setTimeout(resolve, 100)); // Rate limit safety
  }
  
  return prices;
};
