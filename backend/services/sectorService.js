import yahooFinance from 'yahoo-finance2';
import StockMetadata from '../models/StockMetadata.js';

// Get sector for a single stock (with caching)
export const getStockSector = async (symbol) => {
  try {
    // 1. Check cache first
    let metadata = await StockMetadata.findOne({ symbol });
    
    // 2. If found and recent (< 30 days), use cache
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    if (metadata && metadata.lastUpdated > thirtyDaysAgo) {
      console.log(`📦 Using cached sector for ${symbol}`);
      return {
        sector: metadata.sector,
        industry: metadata.industry,
        name: metadata.name
      };
    }
    
    // 3. Fetch from Yahoo API
    console.log(`🔍 Fetching sector for ${symbol} from Yahoo...`);
    
    const result = await yahooFinance.quoteSummary(symbol, {
      modules: ['assetProfile']
    });
    
    const data = {
      sector: result.assetProfile?.sector || 'Others',
      industry: result.assetProfile?.industry || 'N/A',
      name: result.assetProfile?.longName || symbol
    };
    
    // 4. Save/update in database
    await StockMetadata.findOneAndUpdate(
      { symbol },
      { 
        ...data, 
        lastUpdated: new Date() 
      },
      { upsert: true, new: true }
    );
    
    console.log(`✅ Cached sector for ${symbol}: ${data.sector}`);
    return data;
    
  } catch (error) {
    console.error(`⚠️ Error fetching sector for ${symbol}:`, error.message);
    
    // Return default if API fails
    return {
      sector: 'Others',
      industry: 'N/A',
      name: symbol
    };
  }
};

// Get sectors for multiple stocks (batch)
export const getBatchSectors = async (symbols) => {
  const sectorData = {};
  
  console.log(`📊 Fetching sectors for ${symbols.length} stocks...`);
  
  for (const symbol of symbols) {
    sectorData[symbol] = await getStockSector(symbol);
  }
  
  console.log(`✅ All sectors fetched`);
  return sectorData;
};
