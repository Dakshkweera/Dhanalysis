// backend/utils/timezone.js
// Single helper for IST date operations.
// Replaces the duplicated IST offset block in dailySnapshotCron.js.

import { IST_TIMEZONE } from '../config/constants.js';

/**
 * Returns today's date as a UTC midnight Date object, calculated in IST.
 * e.g. if it's 11 PM UTC on Jan 14 (which is 4:30 AM IST Jan 15),
 * this returns 2024-01-15T00:00:00.000Z
 */
export const getISTDate = () => {
  const now = new Date();

  // Format current time in IST to get year/month/day
  const istParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: IST_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);

  const year  = parseInt(istParts.find(p => p.type === 'year').value, 10);
  const month = parseInt(istParts.find(p => p.type === 'month').value, 10) - 1; // 0-indexed
  const day   = parseInt(istParts.find(p => p.type === 'day').value, 10);

  // Return as UTC midnight so MongoDB date comparisons are consistent
  return new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
};

/**
 * Returns a human-readable IST timestamp string for logging.
 */
export const getISTTimestamp = () => {
  return new Date().toLocaleString('en-IN', { timeZone: IST_TIMEZONE });
};
