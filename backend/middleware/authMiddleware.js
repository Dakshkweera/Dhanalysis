// backend/middleware/authMiddleware.js
// JWT authentication middleware.
// Reads Bearer token from Authorization header, verifies it,
// and attaches req.user = { uid, email } for all downstream handlers.

import jwt from 'jsonwebtoken';
import config from '../config/env.js';

export const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'No token provided.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, config.JWT.secret);
    req.user = { uid: decoded.uid, email: decoded.email };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired.', expired: true });
    }
    return res.status(401).json({ success: false, message: 'Invalid token.' });
  }
};
