import express from "express";
import app from "./app.js";
import connectDB from "./config/db.js";
import dotenv from "dotenv";

// Import cron jobs
import { startDailySnapshotCron, startTestCron } from './jobs/dailySnapshotCron.js';

import { notFound, errorHandler } from './middleware/errorMiddleware.js';

// Import routes
import userRoutes from "./routes/userRoutes.js";
import investmentRoutes from "./routes/investmentRoutes.js";
import portfolioRoutes from './routes/portfolioRoutes.js';
import marketRoutes from './routes/marketRoutes.js';

dotenv.config();

// Mount routes
app.use("/api/users", userRoutes);
app.use("/api/investments", investmentRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/market', marketRoutes);

// 404 handler (must be AFTER all routes)
app.use(notFound);

// Global error handler (must be LAST)
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

// Initialize server
const startServer = async () => {
  try {
    // 1. Connect to MongoDB first
    await connectDB();
    
    // 2. Start cron jobs after DB connection
    console.log('\n📅 Initializing Cron Jobs...');
    // startTestCron();  // ← Testing mode (runs every minute)
    startDailySnapshotCron();  // ← Production mode (uncomment for 3:35 PM Mon-Fri)
    
    // 3. Start Express server
    app.listen(PORT, () => {
      console.log(`📍 API: http://localhost:${PORT}\n`);
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
};

// Start the server
startServer();
