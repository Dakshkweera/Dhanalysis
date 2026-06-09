// backend/app.js
// Express app setup — middleware only, no route mounting (done in server.js).

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import config from './config/env.js';
import { apiLimiter } from './middleware/rateLimiter.js';

const app = express();

// CORS — origins loaded from CORS_ORIGINS env var (comma-separated)
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);
    if (config.CORS_ORIGINS.includes(origin)) return callback(null, true);
    return callback(new Error(`CORS: origin '${origin}' not allowed`));
  },
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Global rate limiter — protects all API routes
app.use('/api', apiLimiter);

// Health check
app.get('/', (_req, res) => res.json({ status: 'ok', env: config.NODE_ENV }));

export default app;
