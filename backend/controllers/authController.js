// backend/controllers/authController.js
// In-house JWT authentication — register, login, refresh, logout.
//
// Token strategy:
//   Access token  → 15 min JWT, sent in JSON response, stored in localStorage
//   Refresh token → 7 day JWT, sent as HttpOnly cookie, never readable by JS

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/User.js';
import OtpVerification from '../models/OtpVerification.js';
import config from '../config/env.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateUid() {
  // Random UID similar in feel to Firebase UIDs (28 chars, URL-safe base64)
  return crypto.randomBytes(21).toString('base64url');
}

function signAccessToken(payload) {
  return jwt.sign(payload, config.JWT.secret, { expiresIn: config.JWT.accessExpiry });
}

function signRefreshToken(payload) {
  return jwt.sign(payload, config.JWT.refreshSecret, { expiresIn: config.JWT.refreshExpiry });
}

function setRefreshCookie(res, token) {
  res.cookie('refreshToken', token, {
    httpOnly: true,       // not readable by JS
    secure:   config.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge:   7 * 24 * 60 * 60 * 1000, // 7 days in ms
    path:     '/api/auth/refresh',       // only sent to refresh endpoint
  });
}

// ── POST /api/auth/register ───────────────────────────────────────────────────

export async function register(req, res) {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email and password are required.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
    }

    // Check OTP was verified for this email
    const otpRecord = await OtpVerification.findOne({ email: email.toLowerCase().trim() });
    if (!otpRecord?.verified) {
      return res.status(403).json({ success: false, message: 'Email not verified. Please complete OTP verification first.' });
    }

    // Check email not already registered
    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Email already registered. Please login.' });
    }

    // Hash password (salt rounds = 12)
    const passwordHash = await bcrypt.hash(password, 12);
    const uid          = generateUid();

    const user = await User.create({
      uid,
      email: email.toLowerCase().trim(),
      name:  name.trim(),
      passwordHash,
    });

    // Issue tokens
    const payload      = { uid: user.uid, email: user.email };
    const accessToken  = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    setRefreshCookie(res, refreshToken);

    console.log(`✅ New user registered: ${user.email} (${user.uid})`);

    return res.status(201).json({
      success:     true,
      accessToken,
      user: {
        uid:   user.uid,
        email: user.email,
        name:  user.name,
      },
    });
  } catch (err) {
    console.error('register error:', err.message);
    return res.status(500).json({ success: false, message: 'Registration failed. Try again.' });
  }
}

// ── POST /api/auth/login ──────────────────────────────────────────────────────

export async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });

    // Generic message — don't reveal whether email exists
    if (!user || !user.passwordHash) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const payload      = { uid: user.uid, email: user.email };
    const accessToken  = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    setRefreshCookie(res, refreshToken);

    console.log(`✅ Login: ${user.email}`);

    return res.json({
      success:     true,
      accessToken,
      user: {
        uid:   user.uid,
        email: user.email,
        name:  user.name,
      },
    });
  } catch (err) {
    console.error('login error:', err.message);
    return res.status(500).json({ success: false, message: 'Login failed. Try again.' });
  }
}

// ── POST /api/auth/refresh ────────────────────────────────────────────────────

export async function refresh(req, res) {
  try {
    const token = req.cookies?.refreshToken;

    if (!token) {
      return res.status(401).json({ success: false, message: 'No refresh token.' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, config.JWT.refreshSecret);
    } catch {
      return res.status(401).json({ success: false, message: 'Refresh token expired. Please login again.' });
    }

    // Verify user still exists in DB
    const user = await User.findOne({ uid: decoded.uid });
    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found.' });
    }

    const payload     = { uid: user.uid, email: user.email };
    const accessToken = signAccessToken(payload);

    // Rotate refresh token
    const newRefresh = signRefreshToken(payload);
    setRefreshCookie(res, newRefresh);

    return res.json({ success: true, accessToken });
  } catch (err) {
    console.error('refresh error:', err.message);
    return res.status(500).json({ success: false, message: 'Token refresh failed.' });
  }
}

// ── POST /api/auth/logout ─────────────────────────────────────────────────────

export async function logout(req, res) {
  res.clearCookie('refreshToken', { path: '/api/auth/refresh' });
  return res.json({ success: true, message: 'Logged out successfully.' });
}

// ── GET /api/auth/me ──────────────────────────────────────────────────────────

export async function getMe(req, res) {
  try {
    const user = await User.findOne({ uid: req.user.uid }).select('-passwordHash -__v');
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    return res.json({ success: true, user });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch user.' });
  }
}
