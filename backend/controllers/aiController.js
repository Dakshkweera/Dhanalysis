// backend/controllers/aiController.js
// AI chatbot powered by Groq (llama-3.3-70b-versatile).
// Assembles full portfolio context and passes it to the model so answers
// are specific to the user's holdings — not generic financial advice.

import axios from 'axios';
import ChatHistory from '../models/ChatHistory.js';
import UsageLimit from '../models/UsageLimit.js';
import Investment from '../models/Investment.js';
import User from '../models/User.js';
import DailyReport from '../models/DailyReport.js';
import config from '../config/env.js';
import { AI_QUESTION_LIMIT } from '../config/constants.js';
import { calculatePortfolioMetrics, findTopPerformers } from '../services/portfolioService.js';
import { calculateRollingMetrics, calculateCorrelationWithNifty } from '../services/analyticsService.js';
import { getBatchSectors } from '../services/sectorService.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function getCurrentMonth() {
  return new Date().toISOString().slice(0, 7);
}

async function checkUsageLimit(userId) {
  const currentMonth = getCurrentMonth();
  let usage = await UsageLimit.findOneAndUpdate(
    { userId, month: currentMonth },
    {
      $setOnInsert: {
        questionsAsked: 0,
        questionLimit: AI_QUESTION_LIMIT,
        isPremium: false,
        lastResetDate: new Date(),
      },
    },
    { upsert: true, new: true }
  );

  if (!usage.isPremium && usage.questionsAsked >= usage.questionLimit) {
    return {
      allowed: false,
      remaining: 0,
      limit: usage.questionLimit,
      resetDate: new Date(
        usage.lastResetDate.getFullYear(),
        usage.lastResetDate.getMonth() + 1,
        1
      ),
    };
  }

  return {
    allowed: true,
    remaining: usage.isPremium ? 'Unlimited' : usage.questionLimit - usage.questionsAsked,
    limit: usage.isPremium ? 'Unlimited' : usage.questionLimit,
    current: usage.questionsAsked,
  };
}

async function incrementUsage(userId) {
  const currentMonth = getCurrentMonth();
  await UsageLimit.findOneAndUpdate(
    { userId, month: currentMonth },
    { $inc: { questionsAsked: 1 }, $set: { updatedAt: new Date() } },
    { upsert: true }
  );
}

// ── Portfolio context (direct service calls — no self-HTTP) ──────────────────

async function getPortfolioContext(userId) {
  try {
    const [user, investments] = await Promise.all([
      User.findOne({ uid: userId }),
      Investment.find({ userId }),
    ]);

    if (!user || investments.length === 0) return null;

    // Build a minimal price map from the latest DailyReport snapshot
    const latestSnapshot = await DailyReport.findOne({ userId })
      .sort({ date: -1 })
      .limit(1);

    if (!latestSnapshot) return null;

    // Build price map from stored stockPerformance
    const priceMap = {};
    (latestSnapshot.stockPerformance || []).forEach(s => {
      priceMap[s.symbol] = s.currentPrice;
    });

    // Portfolio summary via service functions
    const metrics = calculatePortfolioMetrics(investments, priceMap, user.firstInvestmentDate);
    const topPerformers = findTopPerformers(investments, priceMap);
    const sectorMap = await getBatchSectors([...new Set(investments.map(i => i.symbol))]);

    // Rolling analytics from stored snapshots
    const rollingMetrics = await calculateRollingMetrics(userId, 365);
    const correlationData = await calculateCorrelationWithNifty(userId, 365);

    // Sector grouping
    const sectorAllocation = {};
    investments.forEach(inv => {
      const sector = sectorMap[inv.symbol]?.sector || 'Others';
      if (!sectorAllocation[sector]) sectorAllocation[sector] = [];
      if (!sectorAllocation[sector].includes(inv.symbol)) {
        sectorAllocation[sector].push(inv.symbol);
      }
    });

    const byStock = Object.entries(
      investments.reduce((acc, inv) => {
        if (!acc[inv.symbol]) acc[inv.symbol] = { totalQty: 0, totalCost: 0 };
        acc[inv.symbol].totalQty  += inv.quantity;
        acc[inv.symbol].totalCost += inv.quantity * inv.buyPrice;
        return acc;
      }, {})
    ).map(([symbol, data]) => {
      const currentPrice = priceMap[symbol] || 0;
      const currentValue = data.totalQty * currentPrice;
      const avgBuy = data.totalCost / data.totalQty;
      const profitLoss = currentValue - data.totalCost;
      const roi = data.totalCost > 0 ? (profitLoss / data.totalCost) * 100 : 0;
      const pct = metrics.currentValue > 0 ? (currentValue / metrics.currentValue) * 100 : 0;
      return { symbol, currentValue, currentPrice, avgBuyPrice: avgBuy, profitLoss, roi, percentage: pct };
    });

    const snap = latestSnapshot;

    const context = `
USER'S PORTFOLIO DATA:

SUMMARY:
- Total Invested: ₹${metrics.totalInvested.toFixed(2)}
- Current Value: ₹${metrics.currentValue.toFixed(2)}
- Profit/Loss: ₹${metrics.profitLoss.toFixed(2)}
- ROI: ${metrics.roi.toFixed(2)}%
- CAGR: ${metrics.cagr !== null ? metrics.cagr.toFixed(2) + '%' : 'N/A (< 30 days)'}
- Holding Period: ${metrics.holdingPeriodDays} days
- Total Holdings: ${metrics.totalHoldings} stocks

CURRENT HOLDINGS (by stock):
${byStock.map(s =>
  `- ${s.symbol}: ${s.percentage.toFixed(2)}% (₹${s.currentValue.toFixed(2)}), ROI: ${s.roi.toFixed(2)}%, P/L: ₹${s.profitLoss.toFixed(2)}, Avg Buy: ₹${s.avgBuyPrice.toFixed(2)}, Current: ₹${s.currentPrice.toFixed(2)}`
).join('\n')}

SECTOR ALLOCATION:
${Object.entries(sectorAllocation).map(([sector, stocks]) =>
  `- ${sector}: ${stocks.join(', ')}`
).join('\n')}

TOP PERFORMERS:
- Best: ${topPerformers.best?.symbol || 'N/A'} (ROI: ${topPerformers.best?.roi?.toFixed(2) || 0}%)
- Worst: ${topPerformers.worst?.symbol || 'N/A'} (ROI: ${topPerformers.worst?.roi?.toFixed(2) || 0}%)

LATEST DAY PERFORMANCE (${snap.date?.toISOString().split('T')[0]}):
- Portfolio Value: ₹${snap.portfolioValue?.toFixed(2)}
- Daily Return: ${snap.dailyReturn?.toFixed(2) || 0}%
- Current Drawdown: ${snap.currentDrawdown?.toFixed(2) || 0}%
- Peak Return: ${snap.peakReturn?.toFixed(2) || 0}%
- Beat NIFTY Today: ${snap.benchmarkComparison?.beatNifty ? 'Yes' : 'No'}

${rollingMetrics.success ? `
ALL-TIME RISK METRICS:
- Sharpe Ratio: ${rollingMetrics.risk.sharpeRatio.toFixed(2)}
- Annualized Volatility: ${rollingMetrics.risk.annualizedVolatility.toFixed(2)}%
- Max Drawdown: ${rollingMetrics.risk.maxDrawdown.toFixed(2)}%
- Win Rate: ${rollingMetrics.performance.winRate.toFixed(2)}%
` : '(Insufficient data for risk metrics — need 7+ days of history)'}

${correlationData.success ? `
BENCHMARK COMPARISON:
- Correlation with NIFTY: ${correlationData.correlation} (${correlationData.interpretation})
- Beta: ${correlationData.beta}
` : ''}
`.trim();

    return context;
  } catch (error) {
    console.error('Error assembling portfolio context:', error.message);
    return null;
  }
}

// ── Groq API call ────────────────────────────────────────────────────────────

async function callGroqAPI(question, portfolioContext = null) {
  if (!config.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is not configured');
  }

  const systemPrompt = `You are a professional portfolio analysis assistant for Dhanalysis, an Indian stock portfolio analytics platform.

CRITICAL RULES:
1. NEVER give direct buy/sell recommendations
2. ALWAYS include disclaimer that this is not financial advice
3. Present multiple perspectives (pros and cons)
4. Use phrases like: "Consider...", "Factors to evaluate...", "General principles suggest..."
5. Encourage consulting SEBI-registered advisors
6. Frame predictions as scenarios, not certainties
7. Focus on education and analysis, not advice
8. Keep responses concise and actionable (under 400 words)

Always end responses with: "⚠️ This is informational only. Consult a SEBI-registered advisor for personalized advice."`;

  const userMessage = portfolioContext
    ? `${portfolioContext}\n\nUSER QUESTION: ${question}`
    : question;

  try {
    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userMessage },
        ],
        temperature: 0.3,
        max_tokens: 700,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.GROQ_API_KEY}`,
        },
      }
    );

    const text = response.data.choices?.[0]?.message?.content;
    if (!text) throw new Error('Empty response from Groq');

    return {
      answer:     text,
      tokensUsed: response.data.usage?.total_tokens || 0,
      sources:    [],
    };
  } catch (err) {
    const status = err.response?.status;
    const groqError = new Error(
      status === 429
        ? 'AI service is busy. Please wait a moment and try again.'
        : status === 401
        ? 'Invalid Groq API key.'
        : `Groq API error (${status || err.message})`
    );
    groqError.statusCode = status === 429 ? 429 : 502;
    throw groqError;
  }
}

// ── Route handlers ────────────────────────────────────────────────────────────

export async function handleChat(req, res) {
  try {
    const { userId, question } = req.body;

    // Ownership check — userId in body must match Firebase-verified token
    if (!userId || userId !== req.user?.uid) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: userId does not match authenticated user.',
      });
    }

    if (!question || question.trim().length < 3) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request: question (min 3 chars) required.',
      });
    }

    const usageCheck = await checkUsageLimit(userId);
    if (!usageCheck.allowed) {
      return res.status(429).json({
        success: false,
        message: `Monthly limit of ${usageCheck.limit} questions reached. Resets on ${usageCheck.resetDate.toLocaleDateString()}.`,
        limitReached: true,
        limit: usageCheck.limit,
        resetDate: usageCheck.resetDate,
      });
    }

    console.log(`💬 Chat request from user: ${userId}`);

    const portfolioContext = await getPortfolioContext(userId);
    console.log(portfolioContext ? '✅ Portfolio context loaded' : 'ℹ️ No context — answering as general question');

    const aiResponse = await callGroqAPI(question, portfolioContext);

    await incrementUsage(userId);

    const chatRecord = await new ChatHistory({
      userId,
      question: question.trim(),
      answer:     aiResponse.answer,
      sources:    aiResponse.sources,
      tokensUsed: aiResponse.tokensUsed,
      month:      getCurrentMonth(),
    }).save();

    const updatedUsage = await checkUsageLimit(userId);

    return res.json({
      success: true,
      answer:             aiResponse.answer,
      sources:            aiResponse.sources,
      timestamp:          chatRecord.timestamp,
      hasPortfolioContext: !!portfolioContext,
      usage: {
        remaining: updatedUsage.remaining,
        limit:     updatedUsage.limit,
        current:   (updatedUsage.current || 0) + 1,
      },
    });
  } catch (error) {
    console.error('handleChat Error:', error.message);
    const status = error.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: error.statusCode ? error.message : 'Failed to process your question. Try again later.',
      error: config.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

export async function getChatHistory(req, res) {
  try {
    // Ownership check
    if (req.params.userId !== req.user?.uid) {
      return res.status(403).json({ success: false, message: 'Forbidden.' });
    }

    const limit = parseInt(req.query.limit) || 20;
    const history = await ChatHistory.find({ userId: req.params.userId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .select('question answer sources timestamp');

    return res.json({ success: true, count: history.length, conversations: history });
  } catch (error) {
    console.error('getChatHistory Error:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch chat history' });
  }
}

export async function getUsageStats(req, res) {
  try {
    // Ownership check
    if (req.params.userId !== req.user?.uid) {
      return res.status(403).json({ success: false, message: 'Forbidden.' });
    }

    const currentMonth = getCurrentMonth();
    const usage = await UsageLimit.findOne({ userId: req.params.userId, month: currentMonth });

    if (!usage) {
      return res.json({
        success: true,
        usage: {
          questionsAsked: 0,
          questionLimit:  AI_QUESTION_LIMIT,
          remaining:      AI_QUESTION_LIMIT,
          isPremium:      false,
          resetDate:      new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1),
        },
      });
    }

    return res.json({
      success: true,
      usage: {
        questionsAsked: usage.questionsAsked,
        questionLimit:  usage.isPremium ? 'Unlimited' : usage.questionLimit,
        remaining:      usage.isPremium ? 'Unlimited' : usage.questionLimit - usage.questionsAsked,
        isPremium:      usage.isPremium,
        resetDate:      new Date(
          usage.lastResetDate.getFullYear(),
          usage.lastResetDate.getMonth() + 1,
          1
        ),
      },
    });
  } catch (error) {
    console.error('getUsageStats Error:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch usage stats' });
  }
}
