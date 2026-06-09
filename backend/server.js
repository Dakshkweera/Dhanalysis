// backend/server.js
// Entry point — validates env first, then connects DB, starts cron, mounts routes.

import './config/env.js'; // ← MUST be first: validates all required env vars before anything else
import config from './config/env.js';

import app from './app.js';
import connectDB from './config/db.js';

import { startDailySnapshotCron, triggerManualSnapshot } from './jobs/dailySnapshotCron.js';
import { sendTestEmail } from './services/emailService.js';
import { notFound, errorHandler } from './middleware/errorMiddleware.js';

import userRoutes       from './routes/userRoutes.js';
import investmentRoutes from './routes/investmentRoutes.js';
import portfolioRoutes  from './routes/portfolioRoutes.js';
import marketRoutes     from './routes/marketRoutes.js';
import analyticsRoutes  from './routes/analyticsRoutes.js';
import aiRoutes         from './routes/aiRoutes.js';
import authRoutes        from './routes/authRoutes.js';

// Mount routes
app.use('/api/users',      userRoutes);
app.use('/api/investments', investmentRoutes);
app.use('/api/portfolio',  portfolioRoutes);
app.use('/api/market',     marketRoutes);
app.use('/api/analytics',  analyticsRoutes);
app.use('/api/ai',         aiRoutes);
app.use('/api/auth',       authRoutes);

// Dev-only: manual trigger endpoints for testing
if (config.NODE_ENV !== 'production') {
  app.post('/api/dev/trigger-snapshot', async (req, res) => {
    console.log('🔧 Manual snapshot triggered via API');
    triggerManualSnapshot().catch(err => console.error('Manual snapshot error:', err.message));
    res.json({ success: true, message: 'Snapshot job started — check server logs' });
  });

  app.post('/api/dev/test-email', async (req, res) => {
    const { to } = req.body;
    if (!to) return res.status(400).json({ success: false, message: 'Provide { "to": "email@example.com" }' });
    const result = await sendTestEmail(to);
    res.json(result);
  });
}

// 404 + global error handlers (must be after all routes)
app.use(notFound);
app.use(errorHandler);

const startServer = async () => {
  try {
    await connectDB();

    console.log('\n📅 Initializing Cron Jobs...');
    startDailySnapshotCron();

    app.listen(config.PORT, () => {
      console.log(`🚀 Server running on port ${config.PORT} [${config.NODE_ENV}]\n`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();
