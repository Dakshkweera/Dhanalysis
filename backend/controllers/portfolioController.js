import Investment from '../models/Investment.js';
import User from '../models/User.js';
import DailyReport from '../models/DailyReport.js';
import MarketBenchmark from '../models/MarketBenchmark.js';
import { getBatchStockPrices } from '../services/stockService.js';
import { 
  calculatePortfolioMetrics, 
  findTopPerformers 
} from '../services/portfolioService.js';
import { calculateXIRR } from '../services/xirrService.js';
import { getBatchSectors } from '../services/sectorService.js';
import { getNiftyForDate, calculateNiftyReturn } from '../services/niftyService.js';
import { handleYahooError, handleDbError, sendErrorResponse } from '../utils/errorHandler.js';



 // GET Portfolio Summary
export const getPortfolioSummary = async (req, res) => {
  try {
    
    // Get userId from authenticated user (or body for testing)
    console.log("1. Portfolio summary started");
    const userId = req.user?.uid || req.query.userId || req.body.userId;
    console.log("2. userId:", userId);
    
    if (!userId) {
      return res.status(401).json({ 
        success: false,
        error: 'User ID not provided'
      });
    }
    
    console.log("3. Fetching user...");
    
    // Fetch user to get firstInvestmentDate
    let user;
    try {
      user = await User.findOne({ uid: userId });
      console.log("4. User fetched:", user);
    } catch (dbError) {
      console.error("❌ Database error fetching user:", dbError);
      const errorResponse = handleDbError(dbError);
      return sendErrorResponse(res, errorResponse, 500);
    }
    
    if (!user) {
      return res.status(404).json({ 
        success: false,
        error: 'User not found' 
      });
    }
    
    console.log("5. Fetching investments...");
    
    // Fetch all investments for this user
    let investments;
    try {
      investments = await Investment.find({ userId });
      console.log(`6. Found ${investments.length} investments`);
    } catch (dbError) {
      console.error("❌ Database error fetching investments:", dbError);
      const errorResponse = handleDbError(dbError);
      return sendErrorResponse(res, errorResponse, 500);
    }
    
    // If no investments, return empty summary
    if (investments.length === 0) {
      return res.status(200).json({
        success: true,
        summary: {
          totalInvested: 0,
          currentValue: 0,
          profitLoss: 0,
          roi: 0,
          absoluteReturn: 0,
          cagr: 0,
          xirr: null,
          cagrNote: null,
          holdingPeriodDays: 0,
          firstInvestmentDate: null,
          totalHoldings: 0,
          lastPriceUpdate: new Date().toISOString()
        },
        topPerformers: {
          best: null,
          worst: null
        },
        benchmark: null
      });
    }
    
    console.log("7. Fetching prices...");
    
    // Extract unique symbols
    const symbols = [...new Set(investments.map(inv => inv.symbol))];
    
    // Fetch batch prices with error handling
    let priceMap = {};
    try {
      priceMap = await getBatchStockPrices(symbols);
      console.log("8. Prices fetched:", Object.keys(priceMap).length);
      
      // Check if any prices were fetched
      const successCount = Object.values(priceMap).filter(p => p !== null).length;
      
      if (successCount === 0) {
        return res.status(503).json({
          success: false,
          error: 'Unable to fetch stock prices at the moment.',
          suggestion: 'Market data provider may be temporarily unavailable. Please try again in a few minutes.',
          retryable: true
        });
      }
      
      if (successCount < symbols.length) {
        console.warn(`⚠️ Only ${successCount}/${symbols.length} prices fetched. Some stocks may show stale data.`);
      }
      
    } catch (priceError) {
      console.error('❌ Error fetching prices:', priceError.message);
      
      const errorResponse = handleYahooError(priceError, 'stock prices');
      return sendErrorResponse(res, errorResponse, 503);
    }
    
    // Calculate portfolio metrics
    console.log("9. Calculating metrics...");
    const metrics = calculatePortfolioMetrics(
      investments, 
      priceMap, 
      user.firstInvestmentDate
    );
    console.log("10. Metrics calculated:", metrics);
    
    // Calculate XIRR
    console.log("11. Calculating XIRR...");
    let xirrValue = null;
    try {
      xirrValue = calculateXIRR(investments, metrics.currentValue);
      console.log("12. XIRR calculated:", xirrValue);
    } catch (xirrError) {
      console.warn("⚠️ XIRR calculation failed:", xirrError.message);
      console.log("💡 Continuing without XIRR (may need more time/data)");
      xirrValue = null;
    }

    // Find top performers
    const topPerformers = findTopPerformers(investments, priceMap);
    
    // ========== Fetch Benchmark Data ========== 
    
    console.log("13. Fetching benchmark data...");
    let benchmarkData = null;
    
    try {
      // Get latest snapshot with benchmark data
      const latestSnapshot = await DailyReport.findOne({ userId })
        .sort({ date: -1 })
        .limit(1)
        .select('benchmarkComparison');
      
      if (latestSnapshot && latestSnapshot.benchmarkComparison) {
        benchmarkData = {
          nifty50Value: latestSnapshot.benchmarkComparison.nifty50Value || null,
          nifty50Change: latestSnapshot.benchmarkComparison.nifty50Change || null,
          niftyReturnSinceStart: latestSnapshot.benchmarkComparison.niftyReturnSinceStart || null,
          portfolioReturnSinceStart: latestSnapshot.benchmarkComparison.portfolioReturnSinceStart || null,
          outperformance: latestSnapshot.benchmarkComparison.outperformance || null,
          outperformanceXIRR: latestSnapshot.benchmarkComparison.outperformanceXIRR || null
        };
        
        console.log("14. Benchmark data found:", benchmarkData);
      } else {
        console.log("14. No benchmark data available yet (snapshot not created)");
      }
    } catch (benchmarkError) {
      console.error("⚠️ Error fetching benchmark:", benchmarkError.message);
      console.log("💡 Continuing without benchmark data");
      // Continue without benchmark data (non-critical)
    }
    
    // Build response
    const response = {
      success: true,
      summary: {
        totalInvested: metrics.totalInvested,
        currentValue: metrics.currentValue,
        profitLoss: metrics.profitLoss,
        roi: metrics.roi,
        absoluteReturn: metrics.absoluteReturn,
        cagr: metrics.cagr,
        xirr: xirrValue,
        cagrNote: metrics.cagrNote,
        holdingPeriodDays: metrics.holdingPeriodDays,
        firstInvestmentDate: user.firstInvestmentDate,
        totalHoldings: metrics.totalHoldings,
        lastPriceUpdate: new Date().toISOString()
      },
      topPerformers: {
        best: topPerformers.best,
        worst: topPerformers.worst
      },
      benchmark: benchmarkData
    };
    
    return res.status(200).json(response);
    
  } catch (error) {
    // Catch-all for unexpected errors
    console.error('❌ Unexpected error in getPortfolioSummary:', error);
    
    return res.status(500).json({ 
      success: false,
      error: 'An unexpected error occurred while fetching portfolio summary',
      suggestion: 'Please try again. If the issue persists, contact support.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};




export const createDailySnapshot = async (req, res) => {
  try {
    const userId = req.body?.userId || req.user?.uid;
    
    if (!userId) {
      return res.status(400).json({ message: 'User ID required' });
    }
    
    // Get today's date at midnight UTC
    const now = new Date();
    const today = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      0, 0, 0, 0
    ));
    
    console.log("📅 Creating snapshot for date:", today.toISOString());
    
    // Check if snapshot already exists for today
    const existingSnapshot = await DailyReport.findOne({
      userId,
      date: today
    });
    
    if (existingSnapshot) {
      console.log("⚠️ Snapshot already exists for today");
      return res.status(200).json({
        success: true,
        message: 'Snapshot already exists for today',
        snapshot: existingSnapshot
      });
    }
    
    // Fetch user
    const user = await User.findOne({ uid: userId });
    
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }
    
    // Fetch all investments
    const investments = await Investment.find({ userId });
    
    // Handle empty portfolio
    if (investments.length === 0) {
      const emptySnapshot = await DailyReport.create({
        userId,
        date: today,
        totalInvested: 0,
        portfolioValue: 0,
        profitLoss: 0,
        roi: 0,
        cagr: 0,
        xirr: null,
        absoluteReturn: 0,
        dailyChange: null,
        topPerformers: { best: null, worst: null },
        totalHoldings: 0,
        benchmarkComparison: {}
      });
      
      return res.status(201).json({
        success: true,
        message: 'Empty snapshot created',
        snapshot: emptySnapshot
      });
    }
    
    // Get unique symbols and fetch batch prices
    const symbols = [...new Set(investments.map(inv => inv.symbol))];
    const priceMap = await getBatchStockPrices(symbols);
    
    // Calculate portfolio metrics
    const metrics = calculatePortfolioMetrics(
      investments,
      priceMap,
      user.firstInvestmentDate
    );
    
    // Find top performers
    const topPerformers = findTopPerformers(investments, priceMap);
    
    // Calculate XIRR
    const xirrValue = calculateXIRR(investments, metrics.currentValue);
    
    // Find last available snapshot (handles weekends/holidays)
    const lastSnapshot = await DailyReport.findOne({
      userId,
      date: { $lt: today }
    })
    .sort({ date: -1 })
    .limit(1);
    
    console.log("📊 Last snapshot found:", lastSnapshot ? lastSnapshot.date.toISOString() : "None");
    
    // Calculate daily change with capital tracking
    let dailyChange = null;
    
    if (lastSnapshot) {
      const portfolioValueChange = metrics.currentValue - lastSnapshot.portfolioValue;
      const newCapitalAdded = metrics.totalInvested - lastSnapshot.totalInvested;
      const marketChange = portfolioValueChange - newCapitalAdded;
      
      const totalPercentage = lastSnapshot.portfolioValue > 0
        ? (portfolioValueChange / lastSnapshot.portfolioValue) * 100
        : 0;
      
      const marketChangePercentage = lastSnapshot.portfolioValue > 0 
        ? (marketChange / lastSnapshot.portfolioValue) * 100 
        : 0;
      
      dailyChange = {
        portfolioValue: parseFloat(portfolioValueChange.toFixed(2)),
        percentage: parseFloat(totalPercentage.toFixed(2)),
        newCapitalAdded: parseFloat(newCapitalAdded.toFixed(2)),
        marketChange: parseFloat(marketChange.toFixed(2)),
        marketChangePercentage: parseFloat(marketChangePercentage.toFixed(2))
      };
      
      console.log("📈 Daily change calculated:", dailyChange);
    } else {
      console.log("⚠️ No previous snapshot - first snapshot for this user");
    }

    // Fetch/create NIFTY benchmark for today
    // Fetch/create NIFTY benchmark for today
  let benchmarkComparison = {};

  try {
    console.log('🔍 Fetching NIFTY for today...');
    const todayBenchmark = await getNiftyForDate(today);
    console.log('✅ Today benchmark:', todayBenchmark);
    
    // Calculate NIFTY return since user's first investment
    console.log('📅 User first investment date:', user.firstInvestmentDate);
    
    if (user.firstInvestmentDate) {
      console.log('🔢 Calculating NIFTY return from', user.firstInvestmentDate, 'to', today);
      
      const niftyReturn = await calculateNiftyReturn(
        user.firstInvestmentDate, 
        today
      );
      
      console.log('📊 NIFTY return result:', niftyReturn);
      
      if (niftyReturn) {
        benchmarkComparison = {
          nifty50Value: todayBenchmark.nifty50,
          nifty50Change: todayBenchmark.nifty50Change,
          niftyReturnSinceStart: niftyReturn.return,
          portfolioReturnSinceStart: metrics.roi,
          outperformance: parseFloat((metrics.roi - niftyReturn.return).toFixed(2)),
          outperformanceXIRR: xirrValue ? parseFloat((xirrValue - niftyReturn.return).toFixed(2)) : null
        };
        
        console.log('📊 Benchmark comparison:', benchmarkComparison);
      } else {
        console.log('⚠️ niftyReturn is null!');
      }
    } else {
      console.log('⚠️ User has no firstInvestmentDate!');
    }
  } catch (error) {
    console.error('⚠️ Error fetching benchmark:', error.message);
    console.error('Full error:', error);
    // Continue without benchmark data
  }

    
    // Create snapshot
    const snapshot = await DailyReport.create({
      userId,
      date: today,
      totalInvested: metrics.totalInvested,
      portfolioValue: metrics.currentValue,
      profitLoss: metrics.profitLoss,
      roi: metrics.roi,
      cagr: metrics.cagr,
      xirr: xirrValue,
      absoluteReturn: metrics.absoluteReturn,
      dailyChange: dailyChange,
      topPerformers: {
        best: topPerformers.best,
        worst: topPerformers.worst
      },
      totalHoldings: metrics.totalHoldings,
      benchmarkComparison: benchmarkComparison 
    });
    
    console.log("✅ Snapshot created successfully");
    
    return res.status(201).json({
      success: true,
      message: 'Daily snapshot created successfully',
      snapshot: snapshot
    });
    
  } catch (error) {
    console.error('❌ Error creating daily snapshot:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating daily snapshot',
      error: error.message
    });
  }
};


// Get portfolio history for charts
export const getPortfolioHistory = async (req, res) => {
  try {
    const { userId, days, startDate, endDate } = req.query;
    
    // Validate userId
    if (!userId) {
      return res.status(400).json({ 
        success: false,
        message: "userId is required" 
      });
    }
    
    // Build query
    let query = { userId };
    
    // Option 1: Get last N days
    if (days) {
      const daysCount = parseInt(days);
      const startDateCalc = new Date();
      startDateCalc.setDate(startDateCalc.getDate() - daysCount);
      query.date = { $gte: startDateCalc };
    }
    
    // Option 2: Get date range
    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    
    // Option 3: Get specific start date onwards
    if (startDate && !endDate) {
      query.date = { $gte: new Date(startDate) };
    }
    
    console.log("📊 Fetching history with query:", query);
    
    // Fetch snapshots
    const snapshots = await DailyReport.find(query)
      .sort({ date: 1 })  // Ascending order (oldest first)
      .select('date portfolioValue totalInvested profitLoss roi xirr cagr dailyChange topPerformers benchmarkComparison');
    
    if (snapshots.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No historical data found"
      });
    }
    
    // Format data for frontend
    const data = snapshots.map(snap => ({
      date: snap.date.toISOString().split('T')[0],  // YYYY-MM-DD format
      portfolioValue: snap.portfolioValue,
      totalInvested: snap.totalInvested,
      profitLoss: snap.profitLoss,
      roi: snap.roi,
      xirr: snap.xirr,
      cagr: snap.cagr,
      dailyReturn: snap.dailyChange ? snap.dailyChange.marketChangePercentage : null,
      nifty50: snap.benchmarkComparison?.nifty50Value || null
    }));
    
    // Calculate indexed values for chart (both start at 100)
    const startPortfolioValue = snapshots[0].portfolioValue;
    const startNiftyValue = snapshots[0].benchmarkComparison?.nifty50Value;

    const chartData = data.map((point) => {
      const portfolioIndexed = (point.portfolioValue / startPortfolioValue) * 100;
      const niftyIndexed = startNiftyValue && point.nifty50
        ? (point.nifty50 / startNiftyValue) * 100
        : null;
      
      return {
        ...point,
        portfolioIndexed: parseFloat(portfolioIndexed.toFixed(2)),
        niftyIndexed: niftyIndexed ? parseFloat(niftyIndexed.toFixed(2)) : null
      };
    });
    
    // Calculate period summary
    const startValue = snapshots[0].portfolioValue;
    const endValue = snapshots[snapshots.length - 1].portfolioValue;
    const change = endValue - startValue;
    const changePercent = startValue > 0 ? ((change / startValue) * 100).toFixed(2) : 0;
    
    const startInvested = snapshots[0].totalInvested;
    const endInvested = snapshots[snapshots.length - 1].totalInvested;
    const capitalAdded = endInvested - startInvested;
    
    console.log("✅ Found", snapshots.length, "snapshots");
    
    res.status(200).json({
      success: true,
      count: chartData.length,
      data: chartData,
      summary: {
        startDate: snapshots[0].date,
        endDate: snapshots[snapshots.length - 1].date,
        startValue: startValue,
        endValue: endValue,
        change: parseFloat(change.toFixed(2)),
        changePercent: parseFloat(changePercent),
        capitalAdded: capitalAdded,
        currentXIRR: snapshots[snapshots.length - 1].xirr,
        benchmarkReturn: snapshots[snapshots.length - 1].benchmarkComparison?.niftyReturnSinceStart || null,
        outperformance: snapshots[snapshots.length - 1].benchmarkComparison?.outperformance || null
      }
    });
    
  } catch (error) {
    console.error("❌ Error fetching portfolio history:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching portfolio history",
      error: error.message
    });
  }
};



// Get portfolio allocation (for pie chart)
export const getPortfolioAllocation = async (req, res) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ 
        success: false,
        message: 'userId is required' 
      });
    }
    
    console.log('📊 Calculating portfolio allocation for:', userId);
    
    // Get all investments
    const investments = await Investment.find({ userId });
    
    if (investments.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No investments found'
      });
    }
    
    // Get unique symbols
    const symbols = [...new Set(investments.map(inv => inv.symbol))];
    
    // Fetch current prices
    const priceMap = await getBatchStockPrices(symbols);
    
    // Fetch sectors (with caching)
    const sectorMap = await getBatchSectors(symbols);
    
    // Group investments by symbol and calculate
    const allocationMap = {};
    
    investments.forEach(inv => {
      if (!allocationMap[inv.symbol]) {
        allocationMap[inv.symbol] = {
          symbol: inv.symbol,
          name: sectorMap[inv.symbol].name,
          sector: sectorMap[inv.symbol].sector,
          industry: sectorMap[inv.symbol].industry,
          totalQuantity: 0,
          totalInvested: 0,
          transactions: 0
        };
      }
      
      allocationMap[inv.symbol].totalQuantity += inv.quantity;
      allocationMap[inv.symbol].totalInvested += (inv.quantity * inv.buyPrice);
      allocationMap[inv.symbol].transactions += 1;
    });
    
    // Calculate current values and percentages
    let totalPortfolioValue = 0;
    const allocations = Object.values(allocationMap).map(stock => {
      const currentPrice = priceMap[stock.symbol] || 0;
      const currentValue = stock.totalQuantity * currentPrice;
      const profitLoss = currentValue - stock.totalInvested;
      const roi = stock.totalInvested > 0 
        ? ((profitLoss / stock.totalInvested) * 100) 
        : 0;
      
      totalPortfolioValue += currentValue;
      
      return {
        ...stock,
        avgBuyPrice: parseFloat((stock.totalInvested / stock.totalQuantity).toFixed(2)),
        currentPrice: currentPrice,
        currentValue: parseFloat(currentValue.toFixed(2)),
        profitLoss: parseFloat(profitLoss.toFixed(2)),
        roi: parseFloat(roi.toFixed(2))
      };
    });
    
    // Add percentages
    allocations.forEach(stock => {
      stock.percentage = totalPortfolioValue > 0 
        ? parseFloat(((stock.currentValue / totalPortfolioValue) * 100).toFixed(2))
        : 0;
    });
    
    // Sort by allocation (largest first)
    allocations.sort((a, b) => b.percentage - a.percentage);
    
    // Calculate sector-wise allocation
    const sectorAllocation = {};
    allocations.forEach(stock => {
      if (!sectorAllocation[stock.sector]) {
        sectorAllocation[stock.sector] = {
          sector: stock.sector,
          value: 0,
          percentage: 0,
          stocks: []
        };
      }
      sectorAllocation[stock.sector].value += stock.currentValue;
      sectorAllocation[stock.sector].stocks.push(stock.symbol);
    });
    
    // Calculate sector percentages
    Object.values(sectorAllocation).forEach(sector => {
      sector.percentage = totalPortfolioValue > 0
        ? parseFloat(((sector.value / totalPortfolioValue) * 100).toFixed(2))
        : 0;
      sector.value = parseFloat(sector.value.toFixed(2));
    });
    
    const sectorArray = Object.values(sectorAllocation)
      .sort((a, b) => b.percentage - a.percentage);
    
    console.log('✅ Allocation calculated successfully');
    
    res.status(200).json({
      success: true,
      totalValue: parseFloat(totalPortfolioValue.toFixed(2)),
      byStock: allocations,
      bySector: sectorArray
    });
    
  } catch (error) {
    console.error('❌ Error calculating allocation:', error);
    res.status(500).json({
      success: false,
      message: 'Error calculating portfolio allocation',
      error: error.message
    });
  }
};
