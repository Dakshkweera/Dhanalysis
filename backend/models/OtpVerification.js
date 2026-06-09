// backend/models/OtpVerification.js
// Stores hashed OTPs for email verification during signup.
// Documents auto-delete after 10 minutes via MongoDB TTL index.

import mongoose from 'mongoose';

const otpVerificationSchema = new mongoose.Schema({
  email: {
    type:     String,
    required: true,
    lowercase: true,
    trim:     true,
    index:    true,
  },

  // SHA-256 hash of (otp + email) — never store raw OTP
  hashedOtp: {
    type:     String,
    required: true,
  },

  // Number of wrong attempts — lock after 3
  attempts: {
    type:    Number,
    default: 0,
  },

  // Number of times OTP was sent to this email in current window
  sendCount: {
    type:    Number,
    default: 1,
  },

  // Verified flag — set true after correct OTP, checked by /users/create
  verified: {
    type:    Boolean,
    default: false,
  },

  createdAt: {
    type:    Date,
    default: Date.now,
  },

  // TTL: MongoDB auto-deletes document 10 minutes after createdAt
  expiresAt: {
    type:    Date,
    default: () => new Date(Date.now() + 10 * 60 * 1000),
  },
});

// TTL index — MongoDB removes doc when expiresAt is reached
otpVerificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('OtpVerification', otpVerificationSchema);
