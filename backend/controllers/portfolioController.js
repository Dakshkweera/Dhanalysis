import Investment from '../models/Investment.js';
import User from '../models/User.js';
import DailyReport from '../models/DailyReport.js';
import MarketBenchmark from '../models/MarketBenchmark.js';
import { getMany as getPrices } from '../services/priceStoreService.js';
import { 
  calculatePortfolioMetrics, 
  findTopPerformers 
} from '../services/portfolioService.js';
import { calculateXIRR } from '../services/xirrService.js';
import { getBatchSectors } from '../services/sectorService.js';
import { getNiftyForDate, calculateNiftyReturn } from '../services/niftyService.js';
import { handleYahooError, handleDbError, sendErrorResponse } from '../utils/errorHandler.js';
import {
  calculateDailyChanges,
  calculateDrawdown,
  calculateBenchmarkComparison,
  calculateStockPerformance
} from '../services/metricsCalculator.js';



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
      priceMap = await getPrices(symbols);
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
      
      return res.status(503).json({ success: false, error: 'Unable to fetch stock prices. Please try again shortly.' });
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
        totalHoldings: 0,
        
        // ✅ CORRECTED: Empty portfolio fields
        dailyReturn: 0,
        dailyProfitLoss: 0,
        peakReturn: 0,          // Changed from peakValue
        currentDrawdown: 0,
        benchmarkComparison: {},
        stockPerformance: []
      });
      
      return res.status(201).json({
        success: true,
        message: 'Empty snapshot created',
        snapshot: emptySnapshot
      });
    }
    
    // Get unique symbols and fetch batch prices
    const symbols = [...new Set(investments.map(inv => inv.symbol))];
    const priceMap = await getPrices(symbols);
    
    // Calculate portfolio metrics
    const metrics = calculatePortfolioMetrics(
      investments,
      priceMap,
      user.firstInvestmentDate
    );
    
    // Calculate XIRR
    const xirrValue = calculateXIRR(investments, metrics.currentValue, today);
    
    // ===== GET YESTERDAY'S SNAPSHOT ===== ↓
    
    const yesterdaySnapshot = await DailyReport.findOne({
      userId,
      date: { $lt: today }
    })
    .sort({ date: -1 })
    .limit(1);
    
    console.log("📊 Last snapshot found:", yesterdaySnapshot ? yesterdaySnapshot.date.toISOString() : "None");
    
    // ===== CALCULATE PER-STOCK PERFORMANCE FIRST ===== ↓
    
    const stockPerformance = calculateStockPerformance(
      investments,
      priceMap,
      yesterdaySnapshot?.stockPerformance,
      metrics.currentValue
    );
    
    // ===== CALCULATE DAILY CHANGES (CORRECTED) ===== ↓
    
    const dailyChanges = calculateDailyChanges(stockPerformance);
    
    // ===== CALCULATE DRAWDOWN (CORRECTED) ===== ↓
    
    const previousPeakReturn = yesterdaySnapshot?.peakReturn || null;
    const drawdown = calculateDrawdown(
      metrics.currentValue,
      metrics.totalInvested,
      previousPeakReturn
    );
    
    // ===== CALCULATE BENCHMARK COMPARISON ===== ↓
    
    let benchmarkComparison = {};
    
    try {
      console.log('🔍 Fetching NIFTY for today...');
      
      // Get today's NIFTY data
      const todayBenchmark = await getNiftyForDate(today);
      console.log('✅ Today benchmark:', todayBenchmark);
      
      // Get yesterday's NIFTY to calculate daily change
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      const yesterdayBenchmark = await MarketBenchmark.findOne({
        date: yesterday.toISOString().split('T')[0]
      });
      
      const niftyDailyReturn = yesterdayBenchmark && yesterdayBenchmark.nifty50
        ? ((todayBenchmark.nifty50 - yesterdayBenchmark.nifty50) / yesterdayBenchmark.nifty50) * 100
        : todayBenchmark.nifty50Change || 0;
      
      // Calculate benchmark comparison
      benchmarkComparison = calculateBenchmarkComparison(
        dailyChanges.dailyReturn,
        niftyDailyReturn,
        todayBenchmark.nifty50
      );
      
      console.log('📊 Benchmark comparison:', benchmarkComparison);
      
    } catch (error) {
      console.error('⚠️ Error fetching benchmark:', error.message);
      // Continue without benchmark data
    }
    
    // ===== CREATE SNAPSHOT WITH ALL CORRECTED FIELDS ===== ↓
    
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
      totalHoldings: metrics.totalHoldings,
      
      // ✅ CORRECTED FIELDS (cash-flow free)
      dailyReturn: dailyChanges.dailyReturn,
      dailyProfitLoss: dailyChanges.dailyProfitLoss,
      peakReturn: drawdown.peakReturn,              // Changed from peakValue
      currentDrawdown: drawdown.currentDrawdown,
      benchmarkComparison: benchmarkComparison,
      stockPerformance: stockPerformance
    });
    
    console.log("✅ Snapshot created successfully with cash-flow-free metrics");
    
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
    
    // ✅ FIXED: Select correct fields (peakReturn instead of peakValue)
    const snapshots = await DailyReport.find(query)
      .sort({ date: 1 })
      .select('date portfolioValue totalInvested profitLoss roi xirr cagr dailyReturn dailyProfitLoss peakReturn currentDrawdown benchmarkComparison stockPerformance');
    
    if (snapshots.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No historical data found"
      });
    }
    
    // Format data for frontend
    const data = snapshots.map(snap => ({
      date: snap.date.toISOString().split('T')[0],
      portfolioValue: snap.portfolioValue,
      totalInvested: snap.totalInvested,
      profitLoss: snap.profitLoss,
      roi: snap.roi,
      xirr: snap.xirr,
      cagr: snap.cagr,
      
      // ✅ CORRECT: Cash-flow-free fields
      dailyReturn: snap.dailyReturn || 0,
      dailyProfitLoss: snap.dailyProfitLoss || 0,
      
      // ✅ FIXED: Return-based drawdown fields
      peakReturn: snap.peakReturn || 0,              // Changed from peakValue
      currentDrawdown: snap.currentDrawdown || 0,
      
      // ✅ CORRECT: Benchmark comparison
      nifty50: snap.benchmarkComparison?.nifty50Value || null,
      niftyDailyReturn: snap.benchmarkComparison?.niftyDailyReturn || 0,
      beatNifty: snap.benchmarkComparison?.beatNifty || false,
      outperformance: snap.benchmarkComparison?.outperformance || 0,
      
      // ✅ CORRECT: Stock performance
      stockPerformance: snap.stockPerformance || []
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
    
    // ✅ CORRECT: Calculate market change (excluding capital additions)
    const marketChange = change - capitalAdded;
    const marketChangePercent = startValue > 0 ? ((marketChange / startValue) * 100).toFixed(2) : 0;
    
    // ✅ CORRECT: Drawdown summary (using return-based drawdown)
    const allDrawdowns = snapshots.map(s => s.currentDrawdown || 0);
    const maxDrawdownInPeriod = Math.min(...allDrawdowns);
    
    // ✅ CORRECT: Calculate days above/below benchmark
    const daysAboveNifty = chartData.filter(d => d.beatNifty).length;
    const daysBelowNifty = chartData.length - daysAboveNifty;
    
    console.log("✅ Found", snapshots.length, "snapshots");
    
    res.status(200).json({
      success: true,
      count: chartData.length,
      data: chartData,
      summary: {
        // Date range
        startDate: snapshots[0].date,
        endDate: snapshots[snapshots.length - 1].date,
        
        // Portfolio values
        startValue: parseFloat(startValue.toFixed(2)),
        endValue: parseFloat(endValue.toFixed(2)),
        
        // Returns
        totalChange: parseFloat(change.toFixed(2)),
        totalChangePercent: parseFloat(changePercent),
        
        // ✅ CORRECT: Separate capital vs market change
        capitalAdded: parseFloat(capitalAdded.toFixed(2)),
        marketChange: parseFloat(marketChange.toFixed(2)),
        marketChangePercent: parseFloat(marketChangePercent),
        
        // Performance metrics
        currentXIRR: snapshots[snapshots.length - 1].xirr,
        currentCAGR: snapshots[snapshots.length - 1].cagr,
        
        // ✅ FIXED: Drawdown summary (return-based)
        maxDrawdown: parseFloat(maxDrawdownInPeriod.toFixed(2)),
        currentDrawdown: snapshots[snapshots.length - 1].currentDrawdown || 0,
        peakReturn: snapshots[snapshots.length - 1].peakReturn || 0,  // Changed from peakValue
        
        // ✅ CORRECT: Benchmark comparison
        benchmarkReturn: snapshots[snapshots.length - 1].benchmarkComparison?.niftyDailyReturn || 0,
        outperformance: snapshots[snapshots.length - 1].benchmarkComparison?.outperformance || 0,
        daysAboveNifty: daysAboveNifty,
        daysBelowNifty: daysBelowNifty,
        winRateVsNifty: parseFloat(((daysAboveNifty / chartData.length) * 100).toFixed(2))
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
    const priceMap = await getPrices(symbols);
    
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
