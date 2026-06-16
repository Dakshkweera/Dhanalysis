// backend/routes/aiRoutes.js
// AI chat endpoints — Groq-powered assistant with per-user monthly usage limits.

import express from 'express';
import { handleChat, getChatHistory, getUsageStats } from '../controllers/aiController.js';
import { verifyToken }                               from '../middleware/authMiddleware.js';
import { aiLimiter }                                 from '../middleware/rateLimiter.js';

const router = express.Router();

// Send a message and get an AI response (rate-limited to 10 req/hour per IP)
router.post('/chat', aiLimiter, verifyToken, handleChat);

// Returns past chat messages for the authenticated user
router.get('/history/:userId', verifyToken, getChatHistory);

// Returns how many AI questions the user has used this month vs their limit
router.get('/usage/:userId', verifyToken, getUsageStats);

export default router;
