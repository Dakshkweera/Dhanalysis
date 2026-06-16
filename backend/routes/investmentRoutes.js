// backend/routes/investmentRoutes.js
// CRUD operations for a user's stock investments.

import express from 'express';
import {
  addInvestment,
  getUserInvestments,
  editInvestment,
  deleteInvestment,
  checkUnprocessedInvestments,
} from '../controllers/investmentController.js';
import { verifyToken }                                         from '../middleware/authMiddleware.js';
import { validateInvestment, validateStockSymbol, validateUserId } from '../middleware/validation.js';

const router = express.Router();

// Returns all investments for the authenticated user with live P&L
router.get('/:userId', verifyToken, validateUserId, getUserInvestments);

// Returns count of investments not yet backfilled with historical snapshots
router.get('/unprocessed/:userId', verifyToken, checkUnprocessedInvestments);

// Download all transactions as a CSV file
router.get('/export/:userId', verifyToken, async (req, res) => {
  try {
    const userId = req.user.uid;
    const investments = await (await import('../models/Investment.js')).default
      .find({ userId })
      .sort({ buyDate: 1 });

    if (!investments.length) {
      return res.status(404).json({ error: 'No investments found' });
    }

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

// Add a new investment (validates symbol, fetches historical price from Yahoo Finance)
router.post('/add-investment', verifyToken, validateInvestment, validateStockSymbol, addInvestment);

// Edit quantity, buy price, or buy date of an existing investment
router.put('/edit/:investmentId', verifyToken, validateInvestment, validateStockSymbol, editInvestment);

// Delete an investment by ID
router.delete('/delete/:id', verifyToken, deleteInvestment);

export default router;
