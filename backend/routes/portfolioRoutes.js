// backend/routes/portfolioRoutes.js
// Portfolio-level data — summary metrics, historical snapshots, and allocation.

import express from 'express';
import {
  getPortfolioSummary,
  createDailySnapshot,
  getPortfolioHistory,
  getPortfolioAllocation,
} from '../controllers/portfolioController.js';
import { verifyToken }                          from '../middleware/authMiddleware.js';
import { validateUserId, validateDateRange }    from '../middleware/validation.js';
import { demoProtect }                          from '../middleware/demoProtect.js';
import DailyReport                              from '../models/DailyReport.js';

const router = express.Router();

// Returns current portfolio value, P&L, CAGR, XIRR, and top performers
router.get('/summary', verifyToken, validateUserId, getPortfolioSummary);

// Creates a daily snapshot for the authenticated user (called by cron job at 3:35 PM IST)
router.post('/snapshot', verifyToken, createDailySnapshot);

// Returns historical daily snapshots for chart rendering (?days=30 or ?startDate=&endDate=)
router.get('/history', verifyToken, validateUserId, validateDateRange, getPortfolioHistory);

// Returns portfolio allocation by stock and sector (for pie charts)
router.get('/allocation', verifyToken, validateUserId, getPortfolioAllocation);

// Deletes all daily snapshots for the authenticated user (used during dev/testing)
router.delete('/history', verifyToken, demoProtect, async (req, res) => {
  try {
    const userId = req.user.uid;
    const result = await DailyReport.deleteMany({ userId });
    console.log(`🗑  Deleted ${result.deletedCount} snapshots for ${userId}`);
    res.status(200).json({
      success: true,
      message: `Deleted ${result.deletedCount} portfolio snapshots`,
      deletedCount: result.deletedCount,
    });
  } catch (err) {
    console.error('Error deleting portfolio history:', err);
    res.status(500).json({ success: false, error: 'Failed to delete history' });
  }
});

export default router;
