// backend/middleware/demoProtect.js
// Blocks write operations for the shared demo account.
// Applied to investment POST/PUT/DELETE routes.

import config from '../config/env.js';

export const demoProtect = (req, res, next) => {
  // req.user.uid is set by verifyToken middleware
  if (req.user?.uid === config.DEMO_USER_ID) {
    return res.status(403).json({
      success: false,
      message: 'Demo account is read-only. Sign up to track your own portfolio.',
      isDemo: true,
    });
  }
  next();
};
