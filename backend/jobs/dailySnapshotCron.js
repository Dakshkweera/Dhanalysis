import cron from 'node-cron';
import User from '../models/User.js';
import Investment from '../models/Investment.js';
import DailyReport from '../models/DailyReport.js';
import { getBatchStockPrices } from '../services/stockService.js';
import { 
  calculatePortfolioMetrics, 
  findTopPerformers 
} from '../services/portfolioService.js';
import { sendPortfolioEmail } from '../services/emailService.js';
import { calculateXIRR } from '../services/xirrService.js';


// Function to create snapshot for a single user
const createSnapshotForUser = async (userId) => {
  try {
    console.log(`Creating snapshot for user: ${userId}`);
    
    // Get today's date in IST timezone
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istTime = new Date(now.getTime() + istOffset);
    
    const year = istTime.getUTCFullYear();
    const month = istTime.getUTCMonth();
    const day = istTime.getUTCDate();
    
    const today = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
    
    // Check if snapshot already exists for today
    const existingSnapshot = await DailyReport.findOne({
      userId,
      date: today
    });
    
    if (existingSnapshot) {
      console.log(`Snapshot already exists for user ${userId}`);
      return { success: true, message: 'Snapshot already exists' };
    }
    
    // Fetch user
    const user = await User.findOne({ uid: userId });
    
    if (!user) {
      console.log(`User not found: ${userId}`);
      return { success: false, message: 'User not found' };
    }
    
    // Fetch all investments
    const investments = await Investment.find({ userId });
    
    if (investments.length === 0) {
      // Create empty snapshot
      await DailyReport.create({
        userId,
        date: today,
        totalInvested: 0,
        portfolioValue: 0,
        profitLoss: 0,
        roi: 0,
        cagr: 0,
        absoluteReturn: 0,
        dailyChange: null,
        topPerformers: { best: null, worst: null },
        totalHoldings: 0,
        benchmarkComparison: {}
      });
      
      console.log(`Empty snapshot created for user ${userId}`);
      return { success: true, message: 'Empty snapshot created' };
    }
    
    // Get unique symbols and fetch batch prices
    const symbols = [...new Set(investments.map(inv => inv.symbol))];
    const priceMap = await getBatchStockPrices(symbols);
    
    // Calculate portfolio metrics
    const metrics = calculatePortfolioMetrics(
      investments,
      priceMap,
      user.firstInvestmentDate
    );

    // Calculate XIRR
    const xirrValue = calculateXIRR(investments, metrics.currentValue);

    
    // Find top performers
    const topPerformers = findTopPerformers(investments, priceMap);
    
    // Find last available snapshot (handles weekends/holidays)
    const lastSnapshot = await DailyReport.findOne({
      userId,
      date: { $lt: today }
    })
    .sort({ date: -1 })
    .limit(1);
    
    const yesterdaySnapshot = lastSnapshot;
    
    // Calculate daily change with capital tracking
    let dailyChange = null;
    if (yesterdaySnapshot) {
      const portfolioValueChange = metrics.currentValue - yesterdaySnapshot.portfolioValue;
      const newCapitalAdded = metrics.totalInvested - yesterdaySnapshot.totalInvested;
      const marketChange = portfolioValueChange - newCapitalAdded;
      
      const totalPercentage = (portfolioValueChange / yesterdaySnapshot.portfolioValue) * 100;
      const marketChangePercentage = yesterdaySnapshot.portfolioValue > 0 
        ? (marketChange / yesterdaySnapshot.portfolioValue) * 100 
        : 0;
      
      dailyChange = {
        portfolioValue: parseFloat(portfolioValueChange.toFixed(2)),
        percentage: parseFloat(totalPercentage.toFixed(2)),
        newCapitalAdded: parseFloat(newCapitalAdded.toFixed(2)),
        marketChange: parseFloat(marketChange.toFixed(2)),
        marketChangePercentage: parseFloat(marketChangePercentage.toFixed(2))
      };
    }
    
    // Create snapshot
    await DailyReport.create({
      userId,
      date: today,
      totalInvested: metrics.totalInvested,
      portfolioValue: metrics.currentValue,
      profitLoss: metrics.profitLoss,
      roi: metrics.roi,
      cagr: metrics.cagr,
      xirr: xirrValue,
      absoluteReturn: metrics.absoluteReturn,
      dailyChange: dailyChange,
      topPerformers: {
        best: topPerformers.best,
        worst: topPerformers.worst
      },
      totalHoldings: metrics.totalHoldings,
      benchmarkComparison: {}
    });
    
    console.log(`Snapshot created successfully for user ${userId}`);
    return { success: true, message: 'Snapshot created' };
    
  } catch (error) {
    console.error(`Error creating snapshot for user ${userId}:`, error.message);
    return { success: false, message: error.message };
  }
};

// Function to create snapshots for all users AND send emails
const createDailySnapshotsForAllUsers = async () => {
  try {
    console.log('\n=== Daily Snapshot Cron Job Started ===');
    console.log('Time:', new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }));
    
    // Get all unique user IDs from investments
    const userIds = await Investment.distinct('userId');
    
    if (userIds.length === 0) {
      console.log('No users with investments found');
      return;
    }
    
    console.log(`Found ${userIds.length} user(s) with investments`);
    
    // STEP 1: Create snapshots for each user
    console.log('\n📸 Creating snapshots...');
    const snapshotResults = await Promise.allSettled(
      userIds.map(userId => createSnapshotForUser(userId))
    );
    
    const snapshotsCreated = snapshotResults.filter(
      r => r.status === 'fulfilled' && r.value.success
    ).length;
    
    console.log(`✅ Snapshots: ${snapshotsCreated} successful\n`);
    
    // STEP 2: Send emails to each user
    console.log('📧 Sending email notifications...');
    
    const emailResults = [];
    
    for (const userId of userIds) {
      try {
        // Get user details
        const user = await User.findOne({ uid: userId });
        
        if (!user || !user.email) {
          console.log(`⚠️  User ${userId}: No email set, skipping`);
          emailResults.push({ userId, status: 'skipped', reason: 'no email' });
          continue;
        }
        
        // Check notification preference
        if (user.notifications && user.notifications.email === false) {
          console.log(`⚠️  User ${userId}: Notifications disabled, skipping`);
          emailResults.push({ userId, status: 'skipped', reason: 'disabled' });
          continue;
        }
        
        // Get today's snapshot (using IST timezone)
        const now = new Date();
        const istOffset = 5.5 * 60 * 60 * 1000;
        const istTime = new Date(now.getTime() + istOffset);
        const year = istTime.getUTCFullYear();
        const month = istTime.getUTCMonth();
        const day = istTime.getUTCDate();
        const todayDate = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
        
        const snapshot = await DailyReport.findOne({
          userId: userId,
          date: todayDate
        });
        
        if (!snapshot) {
          console.log(`⚠️  User ${userId}: No snapshot found for today, skipping`);
          emailResults.push({ userId, status: 'skipped', reason: 'no snapshot' });
          continue;
        }
        
        // Send email
        const result = await sendPortfolioEmail(
          user.email,
          user.name || 'User',
          snapshot
        );
        
        if (result.success) {
          emailResults.push({ userId, status: 'sent', email: user.email });
        } else {
          emailResults.push({ userId, status: 'failed', error: result.error });
        }
        
      } catch (error) {
        console.error(`❌ Error sending email for user ${userId}:`, error.message);
        emailResults.push({ userId, status: 'error', error: error.message });
      }
    }
    
    // Log email results
    const emailsSent = emailResults.filter(r => r.status === 'sent').length;
    const emailsSkipped = emailResults.filter(r => r.status === 'skipped').length;
    const emailsFailed = emailResults.filter(r => r.status === 'failed' || r.status === 'error').length;
    
    console.log(`\n📧 Email Results:`);
    console.log(`   ✅ Sent: ${emailsSent}`);
    console.log(`   ⚠️  Skipped: ${emailsSkipped}`);
    console.log(`   ❌ Failed: ${emailsFailed}`);
    
    console.log('\n=== Daily Snapshot Cron Job Completed ===\n');
    
  } catch (error) {
    console.error('Error in daily snapshot cron job:', error);
  }
};

// Schedule cron job: Run at 3:35 PM IST, Monday to Friday '0 18 * * *'
const startDailySnapshotCron = () => {
  cron.schedule('35 15 * * 1-5', async () => {
    await createDailySnapshotsForAllUsers();
  }, {
    timezone: "Asia/Kolkata"
  });
  
  console.log('✅ Daily Snapshot Cron Job scheduled: 3:35 PM IST (Mon-Fri)');
};

// For testing: Run every minute
const startTestCron = () => {
  cron.schedule('* * * * *', async () => {
    console.log('🧪 TEST MODE: Running snapshot creation...');
    await createDailySnapshotsForAllUsers();
  }, {
    timezone: "Asia/Kolkata"
  });
  
  console.log('🧪 TEST MODE: Cron running every minute');
};

// Export functions
export { 
  startDailySnapshotCron, 
  startTestCron,
  createDailySnapshotsForAllUsers 
};
