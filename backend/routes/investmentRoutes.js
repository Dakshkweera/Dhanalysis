import express from 'express';
import { addInvestment } from '../controllers/investmentController.js';
import { getUserInvestments } from '../controllers/investmentController.js';
import { editInvestment } from '../controllers/investmentController.js';
import { deleteInvestment } from '../controllers/investmentController.js';
import { verifyFirebaseToken } from '../middleware/authMiddleware.js';
import { validateInvestment, validateStockSymbol } from '../middleware/validation.js';
import { validateUserId } from '../middleware/validation.js';
import { generateHistoricalSnapshots } from '../services/batchSnapshotService.js';
import { checkUnprocessedInvestments } from '../controllers/investmentController.js';


const router = express.Router();

// Protected route - user must be authenticated
router.post('/add-investment', verifyFirebaseToken , validateInvestment,validateStockSymbol,addInvestment);
router.get('/:userId', verifyFirebaseToken , validateUserId,getUserInvestments);
router.put('/edit/:investmentId', verifyFirebaseToken , validateInvestment,validateStockSymbol, editInvestment);
router.delete('/delete/:id', verifyFirebaseToken , deleteInvestment);
router.post('/batch-process', async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId is required' });
    }

    // Run batch processing
    const result = await generateHistoricalSnapshots(userId);

    return res.status(200).json(result);

  } catch (error) {
    console.error('Batch process error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Batch processing failed',
      details: error.message 
    });
  }
});

router.get('/unprocessed/:userId', checkUnprocessedInvestments);

export default router;

