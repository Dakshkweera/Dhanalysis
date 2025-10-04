import yahooFinance from 'yahoo-finance2';

// ========== Investment Validation ==========
export const validateInvestment = (req, res, next) => {
  const { symbol, type, quantity, buyPrice, buyDate } = req.body;
  
  // Check required fields
  if (!symbol?.trim()) {
    return res.status(400).json({ 
      success: false,
      error: 'Stock symbol is required' 
    });
  }
  
  if (!type) {
    return res.status(400).json({ 
      success: false,
      error: 'Investment type is required' 
    });
  }
  
  if (!quantity) {
    return res.status(400).json({ 
      success: false,
      error: 'Quantity is required' 
    });
  }
  
  if (!buyPrice) {
    return res.status(400).json({ 
      success: false,
      error: 'Buy price is required' 
    });
  }
  
  if (!buyDate) {
    return res.status(400).json({ 
      success: false,
      error: 'Buy date is required' 
    });
  }
  
  // Validate quantity
  if (isNaN(quantity) || quantity <= 0) {
    return res.status(400).json({ 
      success: false,
      error: 'Quantity must be a positive number' 
    });
  }
  
  // Validate price
  if (isNaN(buyPrice) || buyPrice <= 0) {
    return res.status(400).json({ 
      success: false,
      error: 'Buy price must be a positive number' 
    });
  }
  
  // Validate type
  const allowedTypes = ['Stock', 'ETF', 'Mutual Fund'];
  if (!allowedTypes.includes(type)) {
    return res.status(400).json({ 
      success: false,
      error: `Type must be one of: ${allowedTypes.join(', ')}` 
    });
  }
  
  // Validate date
  const date = new Date(buyDate);
  if (isNaN(date.getTime())) {
    return res.status(400).json({ 
      success: false,
      error: 'Invalid date format' 
    });
  }
  
  // Check if date is in future
  const today = new Date();
  today.setHours(23, 59, 59, 999);  // End of today
  
  if (date > today) {
    return res.status(400).json({ 
      success: false,
      error: 'Buy date cannot be in the future' 
    });
  }
  
  // Check if date is too old (more than 10 years)
  const tenYearsAgo = new Date();
  tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);
  
  if (date < tenYearsAgo) {
    return res.status(400).json({ 
      success: false,
      error: 'Buy date cannot be more than 10 years ago' 
    });
  }
  
  // Validate symbol format (basic check)
  const symbolRegex = /^[A-Z0-9.&-]+$/i;
  if (!symbolRegex.test(symbol.trim())) {
    return res.status(400).json({ 
      success: false,
      error: 'Invalid symbol format. Use alphanumeric characters only.' 
    });
  }
  
  // All validations passed
  next();
};


// ========== User ID Validation ==========
export const validateUserId = (req, res, next) => {
  const userId = req.user?.uid || req.query.userId || req.body.userId;
  
  if (!userId) {
    return res.status(401).json({ 
      success: false,
      error: 'User ID is required' 
    });
  }
  
  next();
};


// ========== Date Range Validation ==========
export const validateDateRange = (req, res, next) => {
  const { startDate, endDate, days } = req.query;
  
  // If days provided, validate it's a number
  if (days && isNaN(parseInt(days))) {
    return res.status(400).json({ 
      success: false,
      error: 'Days must be a valid number' 
    });
  }
  
  // If startDate provided, validate format
  if (startDate && isNaN(Date.parse(startDate))) {
    return res.status(400).json({ 
      success: false,
      error: 'Invalid start date format' 
    });
  }
  
  // If endDate provided, validate format
  if (endDate && isNaN(Date.parse(endDate))) {
    return res.status(400).json({ 
      success: false,
      error: 'Invalid end date format' 
    });
  }
  
  // Validate endDate is after startDate
  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (end < start) {
      return res.status(400).json({ 
        success: false,
        error: 'End date must be after start date' 
      });
    }
  }
  
  next();
};


// ========== Stock Symbol Existence Validation ==========
export const validateStockSymbol = async (req, res, next) => {
  const { symbol } = req.body;
  
  if (!symbol) {
    return next();  // Let other validation catch this
  }
  
  try {
    console.log(`🔍 Validating symbol: ${symbol}`);
    
    // Try to fetch quote from Yahoo Finance
    const quote = await yahooFinance.quote(symbol.toUpperCase().trim());
    
    // Check if quote has valid data
    if (!quote || !quote.regularMarketPrice) {
      console.error(`❌ Invalid or incomplete data for symbol: ${symbol}`);
      return res.status(400).json({ 
        success: false,
        error: `Stock symbol "${symbol}" not found or has no price data.`,
        suggestion: 'Please verify the symbol. For NSE stocks, use format: SYMBOL.NS (e.g., TCS.NS)'
      });
    }
    
    // Symbol exists and has price data!
    console.log(`✅ Symbol validated: ${symbol} - ${quote.longName || quote.shortName || 'Unknown'} (₹${quote.regularMarketPrice})`);
    
    // Attach stock info to request
    req.stockInfo = {
      symbol: symbol.toUpperCase().trim(),
      name: quote.longName || quote.shortName || symbol,
      price: quote.regularMarketPrice
    };
    
    next();
    
  } catch (error) {
    // Symbol doesn't exist or API error
    console.error(`❌ Symbol validation failed for ${symbol}:`, error.message);
    
    // Check error type
    const errorMsg = error.message.toLowerCase();
    
    // Not found errors
    if (errorMsg.includes('not found') || 
        errorMsg.includes('404') || 
        errorMsg.includes('no data found') ||
        errorMsg.includes('invalid symbol') ||
        errorMsg.includes('ticker symbol')) {
      return res.status(400).json({ 
        success: false,
        error: `Stock symbol "${symbol}" not found on Yahoo Finance.`,
        suggestion: 'Please verify the symbol. For NSE stocks, use format: SYMBOL.NS (e.g., TCS.NS)'
      });
    }
    
    // Network/API errors
    if (errorMsg.includes('network') || 
        errorMsg.includes('timeout') || 
        errorMsg.includes('econnrefused') ||
        errorMsg.includes('fetch failed')) {
      console.warn(`⚠️ Network issue, allowing investment (will validate later)`);
      return next();
    }
    
    // For any other error, reject the symbol (safer)
    return res.status(400).json({ 
      success: false,
      error: `Unable to validate stock symbol "${symbol}". Please verify it's correct.`,
      details: 'The symbol may not exist or has incomplete data.',
      suggestion: 'Try a well-known stock like TCS.NS or INFY.NS to test.'
    });
  }
};
