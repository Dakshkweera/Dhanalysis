// backend/controllers/analyticsController.js
// Advanced risk analytics — rolling Sharpe ratio, volatility, drawdown,
// and NIFTY 50 correlation. Reads from stored DailyReport snapshots.

import { calculateRollingMetrics, calculateCorrelationWithNifty } from '../services/analyticsService.js';

// ── GET /api/analytics/rolling-metrics ───────────────────────────────────────
// Returns rolling Sharpe ratio, volatility, and max drawdown over N days.
// Query: ?days=30 (min 7, max 365)

export const getRollingMetrics = async (req, res) => {
  try {
    const userId = req.user.uid;
    const days   = parseInt(req.query.days) || 30;

    if (days < 7 || days > 365) {
      return res.status(400).json({
        success: false,
        message: 'Days must be between 7 and 365',
      });
    }

    const metrics = await calculateRollingMetrics(userId, days);

    if (!metrics.success) {
      return res.status(404).json(metrics);
    }

    return res.status(200).json(metrics);

  } catch (error) {
    console.error('❌ Error in getRollingMetrics:', error);
    return res.status(500).json({
      success: false,
      message: 'Error calculating rolling metrics',
      error: error.message,
    });
  }
};

// ── GET /api/analytics/correlation ───────────────────────────────────────────
// Returns Pearson correlation coefficient between the user's portfolio
// daily returns and NIFTY 50 daily returns over N days.
// Query: ?days=30 (min 7, max 365)

export const getCorrelation = async (req, res) => {
  try {
    const userId = req.user.uid;
    const days   = parseInt(req.query.days) || 30;

    const correlation = await calculateCorrelationWithNifty(userId, days);

    if (!correlation.success) {
      return res.status(404).json(correlation);
    }

    return res.status(200).json(correlation);

  } catch (error) {
    console.error('❌ Error in getCorrelation:', error);
    return res.status(500).json({
      success: false,
      message: 'Error calculating correlation',
      error: error.message,
    });
  }
};
