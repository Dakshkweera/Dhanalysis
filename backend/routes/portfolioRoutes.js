import express from 'express';
import { getPortfolioSummary, createDailySnapshot, getPortfolioHistory, getPortfolioAllocation } from '../controllers/portfolioController.js';
import { verifyFirebaseToken } from '../middleware/authMiddleware.js';
import { validateUserId, validateDateRange } from '../middleware/validation.js';
import { demoProtect } from '../middleware/demoProtect.js';
import DailyReport from '../models/DailyReport.js';

const router = express.Router();

router.get('/summary',    verifyFirebaseToken, validateUserId, getPortfolioSummary);
router.post('/snapshot',  validateUserId, createDailySnapshot);
router.get('/history',    verifyFirebaseToken, validateUserId, validateDateRange, getPortfolioHistory);
router.get('/allocation', verifyFirebaseToken, validateUserId, getPortfolioAllocation);

// DELETE /api/portfolio/history — wipe all daily snapshots for this user
router.delete('/history', verifyFirebaseToken, demoProtect, async (req, res) => {
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
