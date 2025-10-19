import express from 'express';
import { handleChat, getChatHistory } from '../controllers/aiController.js';
// Uncomment when adding auth later:
// import { verifyFirebaseToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// POST /api/ai/chat - Main chat endpoint (no auth for testing)
router.post('/chat', handleChat);

// GET /api/ai/history/:userId - Get chat history
router.get('/history/:userId', getChatHistory);

export default router;
