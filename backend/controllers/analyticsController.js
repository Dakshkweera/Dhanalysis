// backend/controllers/analyticsController.js

import { calculateRollingMetrics, calculateCorrelationWithNifty } from '../services/analyticsService.js';

/**
 * GET /api/analytics/rolling-metrics
 * Calculate rolling metrics for specified period
 */
export const getRollingMetrics = async (req, res) => {
  try {
    const userId = req.user?.uid || req.query.userId;
    const days = parseInt(req.query.days) || 30;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID required'
      });
    }
    
    if (days < 7 || days > 365) {
      return res.status(400).json({
        success: false,
        message: 'Days must be between 7 and 365'
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
      error: error.message
    });
  }
};

/**
 * GET /api/analytics/correlation
 * Calculate correlation with NIFTY
 */
export const getCorrelation = async (req, res) => {
  try {
    const userId = req.user?.uid || req.query.userId;
    const days = parseInt(req.query.days) || 30;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID required'
      });
    }
    
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
      error: error.message
    });
  }
};
