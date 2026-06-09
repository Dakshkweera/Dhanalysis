import express from 'express';
import {
  addInvestment,
  getUserInvestments,
  editInvestment,
  deleteInvestment,
  checkUnprocessedInvestments,
} from '../controllers/investmentController.js';
import { verifyFirebaseToken }                              from '../middleware/authMiddleware.js';
import { validateInvestment, validateStockSymbol, validateUserId } from '../middleware/validation.js';
import { demoProtect }                                      from '../middleware/demoProtect.js';

const router = express.Router();

// Read routes
router.get('/:userId',             verifyFirebaseToken, validateUserId, getUserInvestments);
router.get('/unprocessed/:userId', checkUnprocessedInvestments);

// Export transactions as CSV
router.get('/export/:userId', verifyFirebaseToken, async (req, res) => {
  try {
    const userId = req.user.uid;
    const investments = await (await import('../models/Investment.js')).default
      .find({ userId })
      .sort({ buyDate: 1 });

    if (!investments.length) {
      return res.status(404).json({ error: 'No investments found' });
    }

    // Build CSV
    const rows = [
      ['Symbol', 'Type', 'Quantity', 'Buy Price (₹)', 'Buy Date', 'Total Invested (₹)'],
      ...investments.map(inv => [
        inv.symbol,
        inv.type,
        inv.quantity,
        inv.buyPrice,
        new Date(inv.buyDate).toISOString().split('T')[0],
        (inv.quantity * inv.buyPrice).toFixed(2),
      ])
    ];

    const csv = rows.map(r => r.join(',')).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="dhanalysis-transactions.csv"');
    res.send(csv);

  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ error: 'Export failed' });
  }
});

// Write routes — demo account blocked
router.post('/add-investment',    verifyFirebaseToken, demoProtect, validateInvestment, validateStockSymbol, addInvestment);
router.put('/edit/:investmentId', verifyFirebaseToken, demoProtect, validateInvestment, validateStockSymbol, editInvestment);
router.delete('/delete/:id',      verifyFirebaseToken, demoProtect, deleteInvestment);

export default router;
