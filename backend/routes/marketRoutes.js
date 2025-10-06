import express from 'express';
import MarketBenchmark from '../models/MarketBenchmark.js';

const router = express.Router();

// GET /api/market/nifty?days=7 - Get NIFTY data for last N days
// GET /api/market/nifty - Get today's NIFTY data only
router.get('/nifty', async (req, res) => {
  try {
    const { days } = req.query;
    
    // If days parameter provided, return historical data
    if (days) {
      const daysNum = parseInt(days);
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysNum);
      
      const niftyData = await MarketBenchmark.find({
        date: {
          $gte: startDate.toISOString().split('T')[0],
          $lte: endDate.toISOString().split('T')[0]
        }
      }).sort({ date: 1 });
      
      if (!niftyData || niftyData.length === 0) {
        return res.status(404).json({ 
          success: false, 
          error: 'NIFTY data not available for this period' 
        });
      }
      
      // Format response
      const formattedData = niftyData.map(day => ({
        date: day.date,
        value: day.nifty50,
        changePercent: day.nifty50Change || 0,
        change: day.nifty50ChangeValue || 0
      }));
      
      return res.status(200).json({
        success: true,
        data: formattedData,
        summary: {
          startValue: formattedData[0].value,
          endValue: formattedData[formattedData.length - 1].value,
          totalChangePercent: ((formattedData[formattedData.length - 1].value - formattedData[0].value) / formattedData[0].value) * 100
        }
      });
    }
    
    // If no days parameter, return today's data only
    const today = new Date().toISOString().split('T')[0];
    const niftyData = await MarketBenchmark.findOne({ date: today });
    
    if (!niftyData) {
      // If today's data not available, get latest
      const latestNifty = await MarketBenchmark.findOne().sort({ date: -1 });
      
      if (!latestNifty) {
        return res.status(404).json({ 
          success: false, 
          error: 'NIFTY data not available' 
        });
      }
      
      return res.status(200).json({
        success: true,
        nifty: {
          value: latestNifty.nifty50,
          changePercent: latestNifty.nifty50Change || 0,
          change: latestNifty.nifty50ChangeValue || 0,
          date: latestNifty.date
        }
      });
    }
    
    return res.status(200).json({
      success: true,
      nifty: {
        value: niftyData.nifty50,
        changePercent: niftyData.nifty50Change || 0,
        change: niftyData.nifty50ChangeValue || 0,
        date: niftyData.date
      }
    });
    
  } catch (error) {
    console.error('Error fetching NIFTY data:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch NIFTY data' 
    });
  }
});

export default router;
