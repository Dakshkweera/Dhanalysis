// backend/controllers/otpController.js
// Handles OTP send + verify for email verification during signup.
//
// Flow:
//   1. POST /api/auth/send-otp   → generate OTP, hash it, store, send email
//   2. POST /api/auth/verify-otp → compare hash, mark verified
//   3. Frontend proceeds with Firebase createUserWithEmailAndPassword
//   4. POST /api/users/create checks email is verified before saving user

import crypto from 'crypto';
import OtpVerification from '../models/OtpVerification.js';
import { sendOtpEmail } from '../services/otpEmailService.js';
import User from '../models/User.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

const OTP_EXPIRY_MS   = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS    = 3;               // lock after 3 wrong guesses
const MAX_SEND_COUNT  = 3;               // max resends per 10-min window

function generateOtp() {
  // Cryptographically random 6-digit number
  const buf = crypto.randomBytes(3);               // 3 bytes = 0–16,777,215
  return String(100000 + (buf.readUIntBE(0, 3) % 900000)); // always 6 digits
}

function hashOtp(otp, email) {
  // Bind hash to email so a stolen hash can't be reused on another account
  return crypto
    .createHash('sha256')
    .update(`${otp}:${email.toLowerCase()}`)
    .digest('hex');
}

// ── POST /api/auth/send-otp ───────────────────────────────────────────────────

export async function sendOtp(req, res) {
  try {
    const { email } = req.body;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, message: 'Valid email required.' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Block if email already has a verified + active Dhanalysis account
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'Email already registered. Please login.' });
    }

    // Check existing OTP doc
    const existing = await OtpVerification.findOne({ email: normalizedEmail });

    if (existing) {
      // Rate-limit resends: max 3 per window
      if (existing.sendCount >= MAX_SEND_COUNT) {
        const waitMs = existing.expiresAt - Date.now();
        const waitMin = Math.ceil(waitMs / 60000);
        return res.status(429).json({
          success: false,
          message: `Too many OTP requests. Please wait ${waitMin} minute(s) and try again.`,
        });
      }

      // Generate fresh OTP, update existing doc
      const otp       = generateOtp();
      const hashedOtp = hashOtp(otp, normalizedEmail);

      await OtpVerification.findOneAndUpdate(
        { email: normalizedEmail },
        {
          hashedOtp,
          attempts:  0,
          verified:  false,
          sendCount: existing.sendCount + 1,
          expiresAt: new Date(Date.now() + OTP_EXPIRY_MS),
          createdAt: new Date(),
        }
      );

      await sendOtpEmail(normalizedEmail, otp);
      return res.json({ success: true, message: 'New OTP sent to your email.' });
    }

    // First send — create new OTP doc
    const otp       = generateOtp();
    const hashedOtp = hashOtp(otp, normalizedEmail);

    await OtpVerification.create({
      email:     normalizedEmail,
      hashedOtp,
      expiresAt: new Date(Date.now() + OTP_EXPIRY_MS),
    });

    await sendOtpEmail(normalizedEmail, otp);

    return res.json({ success: true, message: 'OTP sent to your email. Valid for 10 minutes.' });

  } catch (err) {
    console.error('sendOtp error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to send OTP. Try again.' });
  }
}

// ── POST /api/auth/verify-otp ─────────────────────────────────────────────────

export async function verifyOtp(req, res) {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email and OTP required.' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const record = await OtpVerification.findOne({ email: normalizedEmail });

    // No record (expired or never sent)
    if (!record) {
      return res.status(400).json({ success: false, message: 'OTP expired or not found. Please request a new one.' });
    }

    // Already verified
    if (record.verified) {
      return res.json({ success: true, message: 'Email already verified. Proceed with signup.' });
    }

    // Too many wrong attempts
    if (record.attempts >= MAX_ATTEMPTS) {
      return res.status(429).json({
        success: false,
        message: 'Too many incorrect attempts. Request a new OTP.',
      });
    }

    // Compare hash
    const inputHash = hashOtp(String(otp).trim(), normalizedEmail);
    if (inputHash !== record.hashedOtp) {
      await OtpVerification.findOneAndUpdate(
        { email: normalizedEmail },
        { $inc: { attempts: 1 } }
      );
      const remaining = MAX_ATTEMPTS - (record.attempts + 1);
      return res.status(400).json({
        success: false,
        message: remaining > 0
          ? `Incorrect OTP. ${remaining} attempt(s) remaining.`
          : 'Too many incorrect attempts. Request a new OTP.',
      });
    }

    // ✅ Correct — mark verified
    await OtpVerification.findOneAndUpdate(
      { email: normalizedEmail },
      { verified: true, attempts: 0 }
    );

    return res.json({ success: true, message: 'Email verified successfully! Proceed with signup.' });

  } catch (err) {
    console.error('verifyOtp error:', err.message);
    return res.status(500).json({ success: false, message: 'Verification failed. Try again.' });
  }
}

// ── GET /api/auth/check-verified (called by /users/create) ───────────────────

export async function checkEmailVerified(email) {
  const record = await OtpVerification.findOne({ email: email.toLowerCase().trim() });
  return record?.verified === true;
}
