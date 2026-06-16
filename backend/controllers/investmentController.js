import Investment    from '../models/Investment.js';
import User          from '../models/User.js';
import StockMetadata from '../models/StockMetadata.js';
import { getMany as getPrices }             from '../services/priceStoreService.js';
import { storeLastWeekSnapshots }           from '../services/backfillService.js';
import { getPriceOnDate }                   from '../services/yahooFinanceService.js';
import { handleDbError, sendErrorResponse } from '../utils/errorHandler.js';


export const addInvestment = async (req, res) => {
  try {
    const userId = req.user.uid;
    const { symbol, type, quantity, buyPrice, buyDate } = req.body;

    // Basic field validation — buyPrice is optional (auto-fetched if not provided)
    if (!symbol || !type || !quantity || !buyDate) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    if (quantity <= 0) {
      return res.status(400).json({ error: 'Quantity must be a positive number' });
    }
    const allowedTypes = ['Stock', 'ETF', 'Mutual Fund'];
    if (!allowedTypes.includes(type)) {
      return res.status(400).json({ error: 'Invalid investment type' });
    }
    const parsedBuyDate = new Date(buyDate);
    if (isNaN(parsedBuyDate.getTime())) {
      return res.status(400).json({ error: 'Invalid buy date' });
    }

    const cleanSymbol = symbol.toUpperCase().trim();

    // ── Check user exists ────────────────────────────────────────────────────
    const user = await User.findOne({ uid: userId });
    if (!user) return res.status(404).json({ error: 'User not found' });

    // ── Validate trading day + fetch buy price ───────────────────────────────
    // Weekend check first (instant)
    const dayOfWeek = parsedBuyDate.getUTCDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return res.status(400).json({
        error: 'Markets are closed on weekends. Please select a weekday.',
        code:  'NOT_TRADING_DAY',
      });
    }

    // Fetch real price — also confirms it is a trading day
    // If Yahoo has no price for this date it's a market holiday → reject
    let realBuyPrice;
    try {
      realBuyPrice = await getPriceOnDate(cleanSymbol, parsedBuyDate);
    } catch (err) {
      if (err.code === 'NOT_TRADING_DAY') {
        return res.status(400).json({
          error: `${parsedBuyDate.toISOString().split('T')[0]} is a market holiday. Please select a trading day.`,
          code:  'NOT_TRADING_DAY',
        });
      }
      // Other error (network etc) — allow manual price if provided
      realBuyPrice = buyPrice ? parseFloat(buyPrice) : null;
    }

    if (!realBuyPrice || realBuyPrice <= 0) {
      return res.status(422).json({
        error: 'Could not fetch price for this date. Please try another date.',
      });
    }

    console.log(`💰 Buy price: ${cleanSymbol} on ${parsedBuyDate.toISOString().split('T')[0]} → ₹${realBuyPrice}`);

    // ── Save investment with real price ──────────────────────────────────────
    const newInvestment = new Investment({
      userId,
      symbol:      cleanSymbol,
      type,
      quantity,
      buyPrice:    realBuyPrice,
      buyDate:     parsedBuyDate,
      isProcessed: false,
      processedAt: null,
    });
    await newInvestment.save();

    // Update user's firstInvestmentDate if this buy is earlier
    if (!user.firstInvestmentDate || parsedBuyDate < user.firstInvestmentDate) {
      user.firstInvestmentDate = parsedBuyDate;
      await user.save();
      console.log(`📅 firstInvestmentDate → ${parsedBuyDate.toISOString().split('T')[0]}`);
    }

    // ── Respond immediately — backfill runs in background ────────────────────
    res.status(201).json({
      success:    true,
      message:    'Investment added! Charts will update shortly.',
      investment: newInvestment,
    });

    // ── Background: create historical snapshots ───────────────────────────────
    storeLastWeekSnapshots(userId, parsedBuyDate).catch(err =>
      console.error('Background backfill error:', err.message)
    );

  } catch (error) {
    console.error('❌ Error adding investment:', error);
    const errorResponse = handleDbError(error);
    return sendErrorResponse(res, errorResponse, 500);
  }
};



export const getUserInvestments = async (req, res) => {
  try {
    const userId = req.user.uid;

    // Fetch all investments, sorted by newest buyDate first
    const investments = await Investment.find({ userId }).sort({ buyDate: -1 });

    if (investments.length === 0) {
      return res.status(200).json({ investments: [] });
    }

    // Extract unique symbols for price fetching
    const symbols = [...new Set(investments.map(inv => inv.symbol))];

    // Fetch latest prices for these symbols
    const currentPrices = await getPrices(symbols);

    // Enrich each investment with current price and calculations
    const enrichedInvestments = investments.map(inv => {
      const currentPrice = currentPrices[inv.symbol] || 0;
      const investedAmount = inv.quantity * inv.buyPrice;
      const currentValue = inv.quantity * currentPrice;
      const profitLoss = currentValue - investedAmount;
      const roi = investedAmount > 0 ? (profitLoss / investedAmount) * 100 : 0;

      return {
        _id: inv._id,
        symbol: inv.symbol,
        type: inv.type,
        quantity: inv.quantity,
        buyPrice: inv.buyPrice,
        buyDate: inv.buyDate,
        currentPrice: currentPrice.toFixed(2),
        investedAmount: investedAmount.toFixed(2),
        currentValue: currentValue.toFixed(2),
        profitLoss: profitLoss.toFixed(2),
        roi: roi.toFixed(2)
      };
    });

    return res.status(200).json({ investments: enrichedInvestments });
  } catch (error) {
  console.error('❌ Error fetching investments:', error);
  
  const errorResponse = handleDbError(error);
  return sendErrorResponse(res, errorResponse, 500);
}

};





export const editInvestment = async (req, res) => {
  try {
    const { investmentId } = req.params;
    const { quantity, buyPrice, buyDate } = req.body;
    const userId = req.user.uid;

    // Validate at least one field to update
    if (![quantity, buyPrice, buyDate].some(field => field !== undefined)) {
      return res.status(400).json({ error: 'At least one of quantity, buyPrice, or buyDate must be provided.' });
    }

    // Validate individual fields if provided
    if (quantity !== undefined && (typeof quantity !== 'number' || quantity < 0)) {
      return res.status(400).json({ error: 'Quantity must be a non-negative number.' });
    }
    if (buyPrice !== undefined && (typeof buyPrice !== 'number' || buyPrice <= 0)) {
      return res.status(400).json({ error: 'Buy price must be a positive number.' });
    }
    if (buyDate !== undefined) {
      const parsedBuyDate = new Date(buyDate);
      if (isNaN(parsedBuyDate.getTime())) {
        return res.status(400).json({ error: 'Invalid buy date.' });
      }
    }

    // Find investment by id and userId
    const investment = await Investment.findOne({ _id: investmentId, userId });

    if (!investment) {
      return res.status(404).json({ error: 'Investment not found or access denied.' });
    }

    // Store old buyDate for later comparison
    const oldBuyDate = investment.buyDate;

    // Handle quantity update
    if (quantity !== undefined) {
      if (quantity === 0) {
        // Delete investment if quantity set to zero
        await investment.deleteOne();

        // Update user's firstInvestmentDate if necessary
        const user = await User.findOne({ uid: userId });
        if (user && oldBuyDate.getTime() === user.firstInvestmentDate?.getTime()) {
          // Find earliest buyDate among all remaining investments
          const earliestInvestment = await Investment.findOne({ userId }).sort({ buyDate: 1 }).limit(1);
          user.firstInvestmentDate = earliestInvestment ? earliestInvestment.buyDate : null;
          await user.save();
        }

        return res.status(200).json({ message: 'Investment deleted because quantity was set to zero.' });
      } else {
        investment.quantity = quantity;
      }
    }

    if (buyPrice !== undefined) investment.buyPrice = buyPrice;
    if (buyDate !== undefined) investment.buyDate = new Date(buyDate);

    await investment.save();

    // Update user's firstInvestmentDate if buyDate was changed
    if (buyDate !== undefined) {
      const user = await User.findOne({ uid: userId });

      if (
        !user.firstInvestmentDate ||
        investment.buyDate < user.firstInvestmentDate ||
        oldBuyDate.getTime() === user.firstInvestmentDate.getTime()
      ) {
        const earliestInvestment = await Investment.findOne({ userId }).sort({ buyDate: 1 }).limit(1);
        user.firstInvestmentDate = earliestInvestment ? earliestInvestment.buyDate : null;
        await user.save();
      }
    }

    return res.status(200).json({ message: 'Investment updated successfully', investment });
  } catch (error) {
  console.error('❌ Error updating investment:', error);
  
  const errorResponse = handleDbError(error);
  return sendErrorResponse(res, errorResponse, 500);
}

};



// DELETE investment by ID
export const deleteInvestment = async (req, res) => {
  try {
    const userId = req.user.uid;
    
    // Get investment ID from URL parameter
    const { id } = req.params;
    const investmentId = id.trim(); // Remove any whitespace
    
    // Find and delete the investment
    // Verify it belongs to the authenticated user
    const deletedInvestment = await Investment.findOneAndDelete({
      _id: investmentId,
      userId: userId
    });
    
    // If investment not found or doesn't belong to user
    if (!deletedInvestment) {
      return res.status(404).json({ 
        message: 'Investment not found or you do not have permission to delete it' 
      });
    }
    
    // After deletion, recalculate user's firstInvestmentDate
    // Find the earliest buyDate among remaining investments
    const earliestInvestment = await Investment.findOne({ userId })
      .sort({ buyDate: 1 }) // Sort ascending (oldest first)
      .limit(1);
    
    // Update user's firstInvestmentDate
    const newFirstInvestmentDate = earliestInvestment 
      ? earliestInvestment.buyDate 
      : null; // null if no investments left
    
    await User.findOneAndUpdate(
      { uid: userId },
      { firstInvestmentDate: newFirstInvestmentDate }
    );
    
    // Clean up StockMetadata if no user anywhere still owns this symbol
    const stillOwned = await Investment.countDocuments({
      symbol: deletedInvestment.symbol
    });
    if (stillOwned === 0) {
      await StockMetadata.deleteOne({ symbol: deletedInvestment.symbol });
      console.log(`🗑  StockMetadata cleaned: ${deletedInvestment.symbol} (no owners left)`);
    }

    res.status(200).json({
      message: 'Investment deleted successfully',
      deletedInvestment: {
        symbol:   deletedInvestment.symbol,
        quantity: deletedInvestment.quantity,
        buyPrice: deletedInvestment.buyPrice,
        buyDate:  deletedInvestment.buyDate
      }
    });
    
  } catch (error) {
  console.error('❌ Error deleting investment:', error);
  
  const errorResponse = handleDbError(error);
  return sendErrorResponse(res, errorResponse, 500);
}

};


// controllers/investmentController.js

export const checkUnprocessedInvestments = async (req, res) => {
  try {
    const userId = req.user.uid;

    const unprocessedCount = await Investment.countDocuments({
      userId,
      isProcessed: false
    });

    const hasUnprocessed = unprocessedCount > 0;

    return res.status(200).json({
      success: true,
      hasUnprocessed,
      unprocessedCount
    });

  } catch (error) {
    console.error('Error checking unprocessed investments:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
};
