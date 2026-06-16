// backend/routes/analyticsRoutes.js
// Advanced analytics — rolling performance metrics and NIFTY correlation.

import express from 'express';
import { getRollingMetrics, getCorrelation } from '../controllers/analyticsController.js';
import { verifyToken }                       from '../middleware/authMiddleware.js';

const router = express.Router();

// Rolling Sharpe ratio, volatility, and max drawdown over N days (?days=30)
router.get('/rolling-metrics', verifyToken, getRollingMetrics);

// Pearson correlation between portfolio daily returns and NIFTY 50 (?days=30)
router.get('/correlation', verifyToken, getCorrelation);

export default router;
