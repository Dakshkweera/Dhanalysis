// backend/routes/analyticsRoutes.js

import express from 'express';
import { getRollingMetrics, getCorrelation } from '../controllers/analyticsController.js';
import { verifyFirebaseToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// GET /api/analytics/rolling-metrics?userId=X&days=30
router.get('/rolling-metrics', verifyFirebaseToken, getRollingMetrics);

// GET /api/analytics/correlation?userId=X&days=30
router.get('/correlation', verifyFirebaseToken, getCorrelation);

export default router;
