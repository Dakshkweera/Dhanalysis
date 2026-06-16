// backend/routes/authRoutes.js
// All authentication endpoints — OTP flow, register, login, token refresh, logout.

import express from 'express';
import { sendOtp, verifyOtp }                        from '../controllers/otpController.js';
import { register, login, refresh, logout, getMe }  from '../controllers/authController.js';
import { verifyToken }                               from '../middleware/authMiddleware.js';
import { authLimiter }                               from '../middleware/rateLimiter.js';

const router = express.Router();

// Step 1 & 2 of signup: send OTP to email, then verify it
router.post('/send-otp',   authLimiter, sendOtp);
router.post('/verify-otp', authLimiter, verifyOtp);

// Step 3 of signup: create account (requires prior OTP verification)
router.post('/register', authLimiter, register);

// Login — returns access token + sets HttpOnly refresh cookie
router.post('/login',   authLimiter, login);

// Silent token refresh — reads HttpOnly cookie, returns new access token
router.post('/refresh', refresh);

// Logout — clears the refresh cookie
router.post('/logout',  logout);

// Returns the currently authenticated user's profile
router.get('/me', verifyToken, getMe);

export default router;
