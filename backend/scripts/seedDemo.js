// backend/scripts/seedDemo.js
// Seeds demo account with 1 year of realistic fake data.
// Run: node backend/scripts/seedDemo.js
//
// 10 investments across different months — Stocks + ETFs + Mutual Fund
// NIFTY follows real 2024-25 trajectory (rally → correction → recovery)
// After today, daily cron at 3:35 PM IST takes over via Alpha Vantage

import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import Investment  from '../models/Investment.js';
import DailyReport from '../models/DailyReport.js';
import User        from '../models/User.js';
import StockMetadata  from '../models/StockMetadata.js';
import MarketBenchmark from '../models/MarketBenchmark.js';

const DEMO_USER_ID = process.env.DEMO_USER_ID;
if (!DEMO_USER_ID) { console.error('❌ DEMO_USER_ID not set'); process.exit(1); }

// ── 10 investments — different months, different asset types ─────────────────
const INVESTMENTS = [
  // June 2024
  { symbol: 'RELIANCE.NS',  type: 'Stock',        quantity: 5,   buyPrice: 2900, buyDate: '2024-06-10', sector: 'Energy',           name: 'Reliance Industries' },
  { symbol: 'TCS.NS',       type: 'Stock',        quantity: 3,   buyPrice: 3800, buyDate: '2024-06-20', sector: 'Technology',        name: 'Tata Consultancy Services' },
  // July 2024
  { symbol: 'HDFCBANK.NS',  type: 'Stock',        quantity: 15,  buyPrice: 1650, buyDate: '2024-07-08', sector: 'Banking',           name: 'HDFC Bank' },
  // August 2024
  { symbol: 'NIFTYBEES.NS', type: 'ETF',          quantity: 100, buyPrice: 240,  buyDate: '2024-08-05', sector: 'ETF',              name: 'Nippon India ETF NIFTY 50 BeES' },
  { symbol: 'TATAMOTORS.NS',type: 'Stock',        quantity: 12,  buyPrice: 950,  buyDate: '2024-08-20', sector: 'Automobile',        name: 'Tata Motors' },
  // September 2024
  { symbol: 'SUNPHARMA.NS', type: 'Stock',        quantity: 8,   buyPrice: 1600, buyDate: '2024-09-12', sector: 'Healthcare',        name: 'Sun Pharmaceutical' },
  // October 2024
  { symbol: 'GOLDBEES.NS',  type: 'ETF',          quantity: 30,  buyPrice: 590,  buyDate: '2024-10-07', sector: 'ETF',              name: 'Nippon India Gold BeES' },
  // November 2024
  { symbol: 'INFY.NS',      type: 'Stock',        quantity: 10,  buyPrice: 1780, buyDate: '2024-11-05', sector: 'Technology',        name: 'Infosys' },
  // December 2024
  { symbol: 'BAJFINANCE.NS',type: 'Stock',        quantity: 2,   buyPrice: 6900, buyDate: '2024-12-03', sector: 'Financial Services', name: 'Bajaj Finance' },
  // January 2025
  { symbol: 'HDFCFLEXI.NS', type: 'Mutual Fund',  quantity: 50,  buyPrice: 95,   buyDate: '2025-01-15', sector: 'Mutual Fund',       name: 'HDFC Flexi Cap Fund' },
];

// Current realistic prices (seeded into StockMetadata so dashboard loads instantly)
const CURRENT_PRICES = {
  'RELIANCE.NS':   1291,
  'TCS.NS':        2198,
  'HDFCBANK.NS':    747,
  'NIFTYBEES.NS':   265,
  'TATAMOTORS.NS':  700,
  'SUNPHARMA.NS':  1720,
  'GOLDBEES.NS':    632,
  'INFY.NS':       1197,
  'BAJFINANCE.NS':  889,  // BSE adjusted price per Alpha Vantage
  'HDFCFLEXI.NS':   108,  // Mutual Fund NAV approx
};

// ── Simulate stock price series ───────────────────────────────────────────────
// Starts at buyPrice, drifts toward currentPrice with daily noise
const simulatePrices = (startPrice, endPrice, days) => {
  const prices = [startPrice];
  const drift = (endPrice - startPrice) / days;
  for (let i = 1; i < days; i++) {
    const prev  = prices[i - 1];
    const noise = (Math.random() - 0.48) * prev * 0.015; // ±1.5% noise
    prices.push(parseFloat(Math.max(prev + drift + noise, prev * 0.93).toFixed(2)));
  }
  return prices;
};

// ── Realistic NIFTY 50 simulation for 2024-25 ────────────────────────────────
// Based on actual NIFTY trajectory:
//   Jun 2024: 23,500 → Sep 2024: 26,200 (bull run) → Nov 2024: 23,300 (correction)
//   → Dec 2024: 23,600 → Mar 2025: 22,200 (FII sell-off) → Jun 2025: 24,500 (recovery)
const simulateNifty = (tradingDays) => {
  const waypoints = [
    { date: new Date('2024-06-01'), value: 23500 },
    { date: new Date('2024-09-27'), value: 26216 }, // all-time high
    { date: new Date('2024-11-22'), value: 23263 }, // correction
    { date: new Date('2024-12-31'), value: 23644 },
    { date: new Date('2025-03-04'), value: 22124 }, // bottom
    { date: new Date('2025-06-08'), value: 24500 }, // recovery
  ];

  return tradingDays.map((date, i) => {
    // Find surrounding waypoints
    let lo = waypoints[0], hi = waypoints[waypoints.length - 1];
    for (let w = 0; w < waypoints.length - 1; w++) {
      if (date >= waypoints[w].date && date <= waypoints[w + 1].date) {
        lo = waypoints[w]; hi = waypoints[w + 1];
        break;
      }
    }
    // Linear interpolation between waypoints
    const total = hi.date - lo.date;
    const elapsed = date - lo.date;
    const t = total > 0 ? elapsed / total : 1;
    const base = lo.value + (hi.value - lo.value) * t;
    // Add daily noise ±0.8%
    const noise = (Math.random() - 0.5) * base * 0.008;
    return parseFloat((base + noise).toFixed(2));
  });
};

// ── Get Mon-Fri trading days ──────────────────────────────────────────────────
const getTradingDays = (start, end) => {
  const days = [];
  const cur = new Date(start);
  while (cur <= end) {
    const d = cur.getDay();
    if (d !== 0 && d !== 6) days.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
};

// ── Main ──────────────────────────────────────────────────────────────────────
async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ MongoDB connected');

  const START_DATE = new Date('2024-06-10');
  const TODAY      = new Date(); TODAY.setHours(0, 0, 0, 0);

  // 1. Upsert demo user
  await User.findOneAndUpdate(
    { uid: DEMO_USER_ID },
    {
      uid:   DEMO_USER_ID,
      email: 'demo@dhanalysis.com',
      name:  'Demo Investor',
      profession: 'Software Engineer',
      investmentGoals: 'Long-term wealth via equities, ETFs & mutual funds',
      riskAppetite: 'Medium',
      firstInvestmentDate: START_DATE,
      notifications: { email: false },
    },
    { upsert: true }
  );
  console.log('✅ Demo user ready');

  // 2. Wipe old data
  await Promise.all([
    Investment.deleteMany({ userId: DEMO_USER_ID }),
    DailyReport.deleteMany({ userId: DEMO_USER_ID }),
  ]);
  console.log('🗑  Cleared old demo data');

  // 3. Insert investments
  await Investment.insertMany(
    INVESTMENTS.map(inv => ({ ...inv, userId: DEMO_USER_ID, isProcessed: true, buyDate: new Date(inv.buyDate) }))
  );
  console.log(`✅ Inserted ${INVESTMENTS.length} investments (Stocks + ETFs + Mutual Fund)`);

  // 4. Build price series for every stock
  const tradingDays = getTradingDays(START_DATE, TODAY);
  const totalDays   = tradingDays.length;
  console.log(`📅 Generating ${totalDays} trading day snapshots...`);

  const priceMatrix = {};
  for (const inv of INVESTMENTS) {
    const buyDateObj  = new Date(inv.buyDate);
    const startIdx    = tradingDays.findIndex(d => d >= buyDateObj);
    const daysActive  = totalDays - Math.max(startIdx, 0);
    const series      = simulatePrices(inv.buyPrice, CURRENT_PRICES[inv.symbol], daysActive);
    // Pad with null before buyDate
    priceMatrix[inv.symbol] = [
      ...Array(Math.max(startIdx, 0)).fill(null),
      ...series,
    ];
  }

  const niftyPrices = simulateNifty(tradingDays);

  // 5. Generate daily snapshots
  const snapshots = [];
  let peakReturn  = null;

  for (let i = 0; i < totalDays; i++) {
    const date = tradingDays[i];
    const activeInvs = INVESTMENTS.filter(inv => new Date(inv.buyDate) <= date);
    if (activeInvs.length === 0) continue;

    let totalInvested = 0, portfolioValue = 0;
    const stockPerformance = [];

    for (const inv of activeInvs) {
      const todayPrice = priceMatrix[inv.symbol][i];
      const prevPrice  = i > 0 ? (priceMatrix[inv.symbol][i - 1] ?? todayPrice) : todayPrice;
      if (!todayPrice) continue;

      totalInvested  += inv.quantity * inv.buyPrice;
      portfolioValue += inv.quantity * todayPrice;

      stockPerformance.push({
        symbol:          inv.symbol,
        quantity:        inv.quantity,
        currentPrice:    parseFloat(todayPrice.toFixed(2)),
        previousPrice:   parseFloat(prevPrice.toFixed(2)),
        value:           parseFloat((inv.quantity * todayPrice).toFixed(2)),
        dayChange:       parseFloat(((todayPrice - prevPrice) / prevPrice * 100).toFixed(2)),
        dayChangeAmount: parseFloat((inv.quantity * (todayPrice - prevPrice)).toFixed(2)),
        weight:          0,
      });
    }

    if (portfolioValue === 0) continue;

    // Fix weights
    stockPerformance.forEach(s => {
      s.weight = parseFloat((s.value / portfolioValue * 100).toFixed(2));
    });

    const dailyReturn   = stockPerformance.reduce((s, x) => s + x.dayChange * x.value, 0) / portfolioValue;
    const profitLoss    = portfolioValue - totalInvested;
    const roi           = profitLoss / totalInvested * 100;
    const years         = (date - START_DATE) / (1000 * 60 * 60 * 24 * 365);
    const cagr          = years > 0.02 ? (Math.pow(portfolioValue / totalInvested, 1 / years) - 1) * 100 : 0;

    // Drawdown
    peakReturn = peakReturn === null ? roi : Math.max(peakReturn, roi);
    const currentDrawdown = roi - peakReturn;

    // NIFTY benchmark
    const niftyToday = niftyPrices[i];
    const niftyPrev  = i > 0 ? niftyPrices[i - 1] : niftyToday;
    const niftyDaily = (niftyToday - niftyPrev) / niftyPrev * 100;

    snapshots.push({
      userId:         DEMO_USER_ID,
      date:           new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())),
      totalInvested:  parseFloat(totalInvested.toFixed(2)),
      portfolioValue: parseFloat(portfolioValue.toFixed(2)),
      profitLoss:     parseFloat(profitLoss.toFixed(2)),
      roi:            parseFloat(roi.toFixed(2)),
      cagr:           parseFloat(cagr.toFixed(2)),
      xirr:           parseFloat((roi * 0.92).toFixed(2)),
      absoluteReturn: parseFloat(profitLoss.toFixed(2)),
      totalHoldings:  activeInvs.length,
      dailyReturn:    parseFloat(dailyReturn.toFixed(2)),
      dailyProfitLoss: parseFloat((dailyReturn / 100 * portfolioValue).toFixed(2)),
      peakReturn:     parseFloat(peakReturn.toFixed(2)),
      currentDrawdown: parseFloat(currentDrawdown.toFixed(2)),
      stockPerformance,
      benchmarkComparison: {
        nifty50Value:     parseFloat(niftyToday.toFixed(2)),
        niftyDailyReturn: parseFloat(niftyDaily.toFixed(2)),
        beatNifty:        dailyReturn > niftyDaily,
        outperformance:   parseFloat((dailyReturn - niftyDaily).toFixed(2)),
      },
    });
  }

  // Batch insert snapshots
  for (let i = 0; i < snapshots.length; i += 100) {
    await DailyReport.insertMany(snapshots.slice(i, i + 100));
  }
  console.log(`✅ Inserted ${snapshots.length} daily snapshots`);

  // 6. Seed prices into StockMetadata (central price library)
  for (const inv of INVESTMENTS) {
    const price = CURRENT_PRICES[inv.symbol];
    await StockMetadata.findOneAndUpdate(
      { symbol: inv.symbol.toUpperCase() },
      {
        $set: {
          latestPrice:   price,
          previousClose: parseFloat((price * 0.992).toFixed(2)),
          changePercent: parseFloat(((Math.random() - 0.4) * 1.5).toFixed(2)),
          priceDate:     TODAY,
          lastFetchedAt: new Date(),
          sector:        inv.sector,
          name:          inv.name,
          industry:      inv.sector,
        },
      },
      { upsert: true }
    );
  }
  console.log('✅ Seeded prices into StockMetadata (central price library)');

  // 7. Seed NIFTY benchmark history (one entry per trading day)
  const niftyDocs = tradingDays.map((date, i) => ({
    date: new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())),
    nifty50: parseFloat(niftyPrices[i].toFixed(2)),
    nifty50Change: i > 0 ? parseFloat(((niftyPrices[i] - niftyPrices[i-1]) / niftyPrices[i-1] * 100).toFixed(2)) : 0,
    nifty50ChangeValue: i > 0 ? parseFloat((niftyPrices[i] - niftyPrices[i-1]).toFixed(2)) : 0,
  }));

  // Upsert each NIFTY entry
  for (const doc of niftyDocs) {
    await MarketBenchmark.findOneAndUpdate(
      { date: doc.date },
      { $set: doc },
      { upsert: true }
    );
  }
  console.log(`✅ Seeded ${niftyDocs.length} NIFTY benchmark entries`);

  const last = snapshots[snapshots.length - 1];
  console.log('\n🎉 Demo account fully ready!');
  console.log(`   Login:          demo@dhanalysis.com / demo123456`);
  console.log(`   Investments:    ${INVESTMENTS.length} (6 Stocks + 2 ETFs + 1 Mutual Fund)`);
  console.log(`   Portfolio:      ₹${last.portfolioValue.toLocaleString('en-IN')}`);
  console.log(`   ROI:            ${last.roi}%  |  CAGR: ${last.cagr}%`);
  console.log(`   Snapshots:      ${snapshots.length} trading days`);
  console.log(`   NIFTY data:     ${niftyDocs.length} days seeded`);
  console.log(`   From today:     daily cron at 3:35 PM IST updates via Alpha Vantage\n`);

  await mongoose.disconnect();
}

seed().catch(err => {
  console.error('❌ Seed failed:', err.message);
  process.exit(1);
});
