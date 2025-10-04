import Investment from '../models/Investment.js';
import User from '../models/User.js';
import { getBatchStockPrices } from '../services/stockService.js';
import { getNiftyForDate } from '../services/niftyService.js';
import { handleDbError, sendErrorResponse } from '../utils/errorHandler.js';


export const addInvestment = async (req, res) => {
  try {
    const { userId, symbol, type, quantity, buyPrice, buyDate } = req.body;

    // Validate inputs
    if (!userId || !symbol || !type || !quantity || !buyPrice || !buyDate) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    if (quantity <= 0 || buyPrice <= 0) {
      return res.status(400).json({ error: 'Quantity and price must be positive numbers' });
    }
    const allowedTypes = ['Stock', 'ETF', 'Mutual Fund'];
    if (!allowedTypes.includes(type)) {
      return res.status(400).json({ error: 'Invalid investment type' });
    }
    const parsedBuyDate = new Date(buyDate);
    if (isNaN(parsedBuyDate.getTime())) {
      return res.status(400).json({ error: 'Invalid buy date' });
    }

    // Check user existence
    const user = await User.findOne({ uid: userId });
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Create investment
    const newInvestment = new Investment({
      userId,
      symbol: symbol.toUpperCase().trim(),
      type,
      quantity,
      buyPrice,
      buyDate: parsedBuyDate,
    });

    // Save investment
    await newInvestment.save();

    // Update user's firstInvestmentDate if earlier or null
    let firstInvestmentUpdated = false;
    if (!user.firstInvestmentDate || parsedBuyDate < user.firstInvestmentDate) {
      user.firstInvestmentDate = parsedBuyDate;
      await user.save();
      firstInvestmentUpdated = true;
      console.log(`📅 Updated firstInvestmentDate to ${parsedBuyDate.toISOString().split('T')[0]}`);
    }

    // ========== NEW: Fetch NIFTY data for this date ========== ↓
    
    try {
      console.log(`📊 Fetching NIFTY benchmark for investment date: ${parsedBuyDate.toISOString().split('T')[0]}`);
      
      await getNiftyForDate(parsedBuyDate);
      
      console.log(`✅ NIFTY data cached for ${parsedBuyDate.toISOString().split('T')[0]}`);
      
    } catch (niftyError) {
      // Don't fail investment addition if NIFTY fetch fails
      console.error(`⚠️ Could not fetch NIFTY data for ${parsedBuyDate.toISOString().split('T')[0]}:`, niftyError.message);
      console.log('💡 Investment saved, but NIFTY data unavailable. Will retry on snapshot creation.');
    }
    
    // ========== END NEW SECTION ========== ↑

    res.status(201).json({ 
  message: 'Investment added', 
  investment: newInvestment,
  stockInfo: req.stockInfo,  // ← Populated by validation!
  firstInvestmentUpdated: firstInvestmentUpdated
});
    
 } catch (error) {
  console.error('❌ Error adding investment:', error);
  
  // Handle database errors specifically
  const errorResponse = handleDbError(error);
  return sendErrorResponse(res, errorResponse, 500);
}
};



export const getUserInvestments = async (req, res) => {
  try {
    const { userId } = req.params;

    // Fetch all investments, sorted by newest buyDate first
    const investments = await Investment.find({ userId }).sort({ buyDate: -1 });

    if (investments.length === 0) {
      return res.status(200).json({ investments: [] });
    }

    // Extract unique symbols for price fetching
    const symbols = [...new Set(investments.map(inv => inv.symbol))];

    // Fetch latest prices for these symbols
    const currentPrices = await getBatchStockPrices(symbols);

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
    const userId = req.user.uid;  // from verifyFirebaseToken middleware
    // const userId = req.body.userId;

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
    // Get authenticated user's Firebase UID from middleware
    // const userId = req.user.uid;
    const userId = req.user?.uid || req.body.userId;
    
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
    
    // Return success response
    res.status(200).json({
      message: 'Investment deleted successfully',
      deletedInvestment: {
        symbol: deletedInvestment.symbol,
        quantity: deletedInvestment.quantity,
        buyPrice: deletedInvestment.buyPrice,
        buyDate: deletedInvestment.buyDate
      }
    });
    
  } catch (error) {
  console.error('❌ Error deleting investment:', error);
  
  const errorResponse = handleDbError(error);
  return sendErrorResponse(res, errorResponse, 500);
}

};
