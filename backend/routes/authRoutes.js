// backend/routes/authRoutes.js
import express from 'express';
import { sendOtp, verifyOtp }            from '../controllers/otpController.js';
import { register, login, refresh, logout, getMe } from '../controllers/authController.js';
import { verifyFirebaseToken }           from '../middleware/authMiddleware.js';
import { authLimiter }                   from '../middleware/rateLimiter.js';

const router = express.Router();

// OTP flow (rate-limited)
router.post('/send-otp',   authLimiter, sendOtp);
router.post('/verify-otp', authLimiter, verifyOtp);

// Auth
router.post('/register', authLimiter, register);
router.post('/login',    authLimiter, login);
router.post('/refresh',  refresh);
router.post('/logout',   logout);
router.get ('/me',       verifyFirebaseToken, getMe);

export default router;
