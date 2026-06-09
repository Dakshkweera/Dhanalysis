import express from 'express';
import { handleChat, getChatHistory, getUsageStats } from '../controllers/aiController.js';
import { verifyFirebaseToken } from '../middleware/authMiddleware.js';
import { aiLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

router.post('/chat',          aiLimiter, verifyFirebaseToken, handleChat);
router.get('/history/:userId',           verifyFirebaseToken, getChatHistory);
router.get('/usage/:userId',             verifyFirebaseToken, getUsageStats);

export default router;
