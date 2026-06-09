// backend/config/env.js
// Single source of truth for environment configuration.
// Validates all required vars at startup — fails fast if anything is missing.

import dotenv from 'dotenv';
dotenv.config();

const required = [
  'MONGO_URI',
  'CORS_ORIGINS',
  'ALPHA_VANTAGE_KEY_1',
  'DEMO_USER_ID',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
];

const missing = required.filter((k) => !process.env[k]);
if (missing.length > 0) {
  console.error(`❌ Missing required env vars: ${missing.join(', ')}`);
  console.error('   Copy .env.example to .env and fill in values, or set them in your host dashboard.');
  process.exit(1);
}

// Collect Alpha Vantage keys (1-5); skip undefined slots so fewer keys still work.
const ALPHA_VANTAGE_KEYS = [
  process.env.ALPHA_VANTAGE_KEY_1,
  process.env.ALPHA_VANTAGE_KEY_2,
  process.env.ALPHA_VANTAGE_KEY_3,
  process.env.ALPHA_VANTAGE_KEY_4,
  process.env.ALPHA_VANTAGE_KEY_5,
  process.env.ALPHA_VANTAGE_KEY_6,
  process.env.ALPHA_VANTAGE_KEY_7,
].filter(Boolean);

const CORS_ORIGINS = process.env.CORS_ORIGINS
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const config = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '5000', 10),

  MONGO_URI: process.env.MONGO_URI,

  CORS_ORIGINS,

  JWT: {
    secret:        process.env.JWT_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpiry:  '15m',
    refreshExpiry: '7d',
  },

  ALPHA_VANTAGE_KEYS,

  RESEND: {
    apiKey: process.env.RESEND_API_KEY,
    from: process.env.RESEND_FROM,
    fromName: process.env.EMAIL_FROM_NAME || 'Dhanalysis',
  },

  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  GROQ_API_KEY: process.env.GROQ_API_KEY || '',

  GMAIL_USER: process.env.GMAIL_USER || '',
  GMAIL_APP_PASSWORD: process.env.GMAIL_APP_PASSWORD || '',

  DEMO_USER_ID: process.env.DEMO_USER_ID,
};

console.log(`✅ Env validated (${config.NODE_ENV}, ${ALPHA_VANTAGE_KEYS.length} Alpha Vantage key(s))`);

export default config;
