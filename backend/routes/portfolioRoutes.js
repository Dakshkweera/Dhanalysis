import express from 'express';
import { getPortfolioSummary } from '../controllers/portfolioController.js';
import { createDailySnapshot } from '../controllers/portfolioController.js';
import { getPortfolioHistory } from '../controllers/portfolioController.js';
import { getPortfolioAllocation } from '../controllers/portfolioController.js';
import { verifyFirebaseToken } from '../middleware/authMiddleware.js';
import { validateUserId, validateDateRange } from '../middleware/validation.js';

const router = express.Router();



// GET Portfolio Summary
// TEMPORARY: Without middleware for testing (remove verifyToken)
router.get('/summary', /*verifyFirebaseToken ,*/validateUserId, getPortfolioSummary);
router.post('/snapshot', /*verifyFirebaseToken ,*/validateUserId, createDailySnapshot);
router.get('/history',/*verifyFirebaseToken ,*/ validateUserId, validateDateRange, getPortfolioHistory);
router.get('/allocation',/*verifyFirebaseToken ,*/validateUserId, getPortfolioAllocation);


// PRODUCTION: With authentication (uncomment when frontend ready)
// router.get('/summary', verifyToken, getPortfolioSummary);

export default router;
