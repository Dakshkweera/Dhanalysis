import express from 'express';
import { addInvestment } from '../controllers/investmentController.js';
import { getUserInvestments } from '../controllers/investmentController.js';
import { editInvestment } from '../controllers/investmentController.js';
import { deleteInvestment } from '../controllers/investmentController.js';
import { verifyFirebaseToken } from '../middleware/authMiddleware.js';
import { validateInvestment, validateStockSymbol } from '../middleware/validation.js';
import { validateUserId } from '../middleware/validation.js';

const router = express.Router();

// Protected route - user must be authenticated
router.post('/add-investment', /*verifyFirebaseToken ,*/ validateInvestment,validateStockSymbol,addInvestment);
router.get('/:userId', /*verifyFirebaseToken ,*/ validateUserId,getUserInvestments);
router.put('/edit/:investmentId', /*verifyFirebaseToken ,*/ validateInvestment,validateStockSymbol, editInvestment);
router.delete('/delete/:id', /*verifyFirebaseToken ,*/ deleteInvestment);

export default router;

