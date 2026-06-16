// backend/middleware/rateLimiter.js
// Rate limiting middleware using express-rate-limit.
// No Redis needed — in-memory store is fine for a single Render instance.

import rateLimit from 'express-rate-limit';

/**
 * General API limiter — applied globally to all /api/* routes.
 * 100 requests per 15 minutes per IP.
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 200 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests. Please wait a few minutes and try again.',
  },
});

/**
 * AI endpoint limiter — stricter, protects Groq API quota.
 * 10 requests per hour per IP.
 */
export const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'AI request limit reached. Please try again in an hour.',
  },
});

/**
 * Auth limiter — prevents brute force on login/signup.
 * 5 requests per minute per IP.
 */
export const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many auth attempts. Please wait a minute.',
  },
});
