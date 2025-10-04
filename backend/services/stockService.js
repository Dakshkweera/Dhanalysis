// import yahooFinance from 'yahoo-finance2';

// export const getBatchStockPrices = async (symbols) => {
//   try {
//     const pricePromises = symbols.map(async (symbol) => {
//       const nseSymbol = symbol.includes('.NS') ? symbol : `${symbol}.NS`; // Adjust if Indian stocks
//       const quote = await yahooFinance.quote(nseSymbol);
//       return { symbol, closePrice: quote.regularMarketPrice || quote.previousClose };
//     });
//     const results = await Promise.all(pricePromises);

//     const priceMap = {};
//     results.forEach(({ symbol, closePrice }) => {
//       priceMap[symbol] = closePrice;
//     });
//     return priceMap;
//   } catch (error) {
//     console.error('Error fetching batch stock prices:', error);
//     throw error;
//   }
// };

import yahooFinance from 'yahoo-finance2';


export const getBatchStockPrices = async (symbols) => {
  try {
    console.log(`📊 Fetching prices for ${symbols.length} symbols...`);
    
    const priceMap = {};
    
    // Fetch prices in parallel
    const results = await Promise.allSettled(
      symbols.map(async (symbol) => {
        try {
          const quote = await yahooFinance.quote(symbol);
          return { symbol, price: quote.regularMarketPrice };
        } catch (error) {
          console.error(`⚠️ Error fetching ${symbol}:`, error.message);
          return { symbol, price: null, error: error.message };
        }
      })
    );
    
    // Process results
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value.price) {
        priceMap[result.value.symbol] = result.value.price;
        console.log(`✅ ${result.value.symbol}: ₹${result.value.price}`);
      } else {
        // Price fetch failed, set to null
        priceMap[symbols[index]] = null;
        console.warn(`❌ ${symbols[index]}: Failed to fetch price`);
      }
    });
    
    // Check if all prices failed
    const successCount = Object.values(priceMap).filter(p => p !== null).length;
    
    if (successCount === 0) {
      throw new Error('Unable to fetch any stock prices. Yahoo Finance may be down.');
    }
    
    console.log(`✅ Fetched ${successCount}/${symbols.length} prices successfully`);
    
    return priceMap;
    
  } catch (error) {
    console.error('❌ Critical error in getBatchStockPrices:', error.message);
    
    // Return empty map but don't crash
    const emptyMap = {};
    symbols.forEach(symbol => {
      emptyMap[symbol] = null;
    });
    
    return emptyMap;
  }
};


