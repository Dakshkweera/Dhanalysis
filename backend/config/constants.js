// backend/config/constants.js
// All magic numbers and shared constants in one place.
// Import from here instead of hardcoding values across services.

// ── Financial calculation constants ──────────────────────────────────────────

// 252 = number of trading days in a year for Indian equity markets (NSE/BSE).
// Used to annualise volatility: dailyStdDev × √252 = annualised volatility.
// Also used to annualise return:  avgDailyReturn × 252 = annualised return.
// Why 252? Markets are open ~252 days/year after removing weekends + holidays.
export const TRADING_DAYS_PER_YEAR = 252;

// The "risk-free rate" = what you'd earn with zero risk (e.g. Indian T-bills or FD).
// Used in Sharpe Ratio: (yourReturn - riskFreeRate) / volatility.
// If your return is 4% and risk-free is 4%, Sharpe = 0 — no reward for risk taken.
export const RISK_FREE_RATE = 4.0;           // % per year, approx. Indian 91-day T-bill

// XIRR needs at least this many days of history to produce a meaningful number.
// Less than 7 days: denominator shrinks, XIRR explodes to unrealistic values.
export const MIN_DAYS_FOR_XIRR = 7;

// Rolling analytics (Sharpe, volatility) need enough daily returns to be statistically valid.
export const MIN_DAYS_FOR_ANALYTICS = 7;

// Cap extreme values to avoid showing "∞%" or "-∞%" in the UI.
// These only trigger in edge cases (brand new portfolios, 1-day holding, etc.)
export const XIRR_CAP_LOW = -99.99;
export const XIRR_CAP_HIGH = 999.99;
export const CAGR_CAP_LOW = -99;
export const CAGR_CAP_HIGH = 999.99;

// AI / usage limits
export const AI_QUESTION_LIMIT = 10;         // Free tier monthly AI question limit
export const AI_QUESTION_LIMIT_PREMIUM = -1; // -1 = unlimited

// Cache
export const PRICE_CACHE_TTL_MS = 30 * 60 * 1000;  // 30 minutes in ms

// Timezone
export const IST_TIMEZONE = 'Asia/Kolkata';

// Sector metadata cache TTL (30 days)
export const SECTOR_CACHE_TTL_DAYS = 30;

// Rolling analytics window sizes
export const ROLLING_WINDOW_30D = 30;
export const ROLLING_WINDOW_90D = 90;
export const ROLLING_WINDOW_180D = 180;

// Backfill
export const BACKFILL_PRICE_DAYS      = 10;  // days to fetch from TIME_SERIES_DAILY (buffer for weekends)
