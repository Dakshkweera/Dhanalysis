import axios from 'axios';
import ChatHistory from '../models/ChatHistory.js';

// Fetch portfolio context from your existing endpoints
async function getPortfolioContext(userId) {
  try {
    const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
    
    // Fetch all portfolio data in parallel
    const [summary, allocation, correlation, rollingMetrics, latestSnapshot] = await Promise.all([
      axios.get(`${baseUrl}/api/portfolio/summary?userId=${userId}`),
      axios.get(`${baseUrl}/api/portfolio/allocation?userId=${userId}`),
      axios.get(`${baseUrl}/api/analytics/correlation?userId=${userId}`), // All-time correlation
      axios.get(`${baseUrl}/api/analytics/rolling-metrics?userId=${userId}`), // All-time metrics
      axios.get(`${baseUrl}/api/portfolio/history?userId=${userId}&days=1`) // Latest snapshot
    ]);

    const summaryData = summary.data.summary;
    const allocationData = allocation.data;
    const correlationData = correlation.data;
    const metricsData = rollingMetrics.data;
    const latestData = latestSnapshot.data.data[0]; // Most recent snapshot

    // Format context for AI
    const context = `
USER'S PORTFOLIO DATA:

SUMMARY:
- Total Invested: ₹${summaryData.totalInvested.toFixed(2)}
- Current Value: ₹${summaryData.currentValue.toFixed(2)}
- Profit/Loss: ₹${summaryData.profitLoss.toFixed(2)}
- ROI: ${summaryData.roi.toFixed(2)}%
- XIRR: ${summaryData.xirr.toFixed(2)}%
- CAGR: ${summaryData.cagr.toFixed(2)}%
- Holding Period: ${summaryData.holdingPeriodDays} days (${Math.floor(summaryData.holdingPeriodDays / 30)} months)
- Total Holdings: ${summaryData.totalHoldings} stocks
- First Investment: ${new Date(summaryData.firstInvestmentDate).toLocaleDateString()}

CURRENT HOLDINGS (by stock):
${allocationData.byStock.map(stock => 
  `- ${stock.symbol}: ${stock.percentage.toFixed(2)}% (₹${stock.currentValue.toFixed(2)}), ROI: ${stock.roi.toFixed(2)}%, P/L: ₹${stock.profitLoss.toFixed(2)}, Avg Buy: ₹${stock.avgBuyPrice.toFixed(2)}, Current: ₹${stock.currentPrice.toFixed(2)}`
).join('\n')}

SECTOR ALLOCATION:
${allocationData.bySector.map(sector => 
  `- ${sector.sector}: ${sector.percentage.toFixed(2)}% (${sector.stocks.join(', ')})`
).join('\n')}

TOP PERFORMERS:
- Best: ${summary.data.topPerformers.best.symbol} (ROI: ${summary.data.topPerformers.best.roi.toFixed(2)}%, P/L: ₹${summary.data.topPerformers.best.profitLoss.toFixed(2)})
- Worst: ${summary.data.topPerformers.worst.symbol} (ROI: ${summary.data.topPerformers.worst.roi.toFixed(2)}%, P/L: ₹${summary.data.topPerformers.worst.profitLoss.toFixed(2)})

LATEST DAY PERFORMANCE (${latestData.date}):
- Portfolio Value: ₹${latestData.portfolioValue.toFixed(2)}
- Daily Return: ${latestData.dailyReturn.toFixed(2)}%
- Daily P/L: ₹${latestData.dailyProfitLoss.toFixed(2)}
- Current Drawdown: ${latestData.currentDrawdown.toFixed(2)}%
- Peak Return: ${latestData.peakReturn.toFixed(2)}%
- NIFTY Return: ${latestData.niftyDailyReturn.toFixed(2)}%
- Beat NIFTY Today: ${latestData.beatNifty ? 'Yes' : 'No'}
- Outperformance: ${latestData.outperformance.toFixed(2)}%

TODAY'S STOCK PERFORMANCE:
${latestData.stockPerformance.map(stock => 
  `- ${stock.symbol}: ${stock.dayChange.toFixed(2)}% (₹${stock.dayChangeAmount.toFixed(2)}), Weight: ${stock.weight.toFixed(2)}%`
).join('\n')}

ALL-TIME RISK METRICS:
- Sharpe Ratio: ${metricsData.risk.sharpeRatio.toFixed(2)}
- Annualized Volatility: ${metricsData.risk.annualizedVolatility.toFixed(2)}%
- Daily Volatility: ${metricsData.risk.dailyVolatility.toFixed(2)}%
- Max Drawdown: ${metricsData.risk.maxDrawdown.toFixed(2)}%

ALL-TIME PERFORMANCE:
- Annualized Return: ${metricsData.returns.annualizedReturn.toFixed(2)}%
- Total Return: ${metricsData.returns.totalReturn.toFixed(2)}%
- Average Daily Return: ${metricsData.returns.avgDailyReturn.toFixed(2)}%
- Best Day: +${metricsData.returns.bestDay.toFixed(2)}%
- Worst Day: ${metricsData.returns.worstDay.toFixed(2)}%
- Win Rate: ${metricsData.performance.winRate.toFixed(2)}%
- Positive Days: ${metricsData.performance.positiveDays}
- Negative Days: ${metricsData.performance.negativeDays}
- Profit Factor: ${metricsData.performance.profitFactor.toFixed(2)}
- Average Gain: ${metricsData.performance.avgGain.toFixed(2)}%
- Average Loss: ${metricsData.performance.avgLoss.toFixed(2)}%

BENCHMARK COMPARISON (All-Time):
- Correlation with NIFTY: ${correlationData.correlation.toFixed(2)} (${correlationData.interpretation})
- Beta: ${correlationData.beta.toFixed(2)}
- Cumulative Outperformance: ${summary.data.benchmark.outperformance.toFixed(2)}%

DATA PERIOD: ${metricsData.dataPoints} trading days from ${new Date(metricsData.dateRange.from).toLocaleDateString()} to ${new Date(metricsData.dateRange.to).toLocaleDateString()}
`;

    return context;

  } catch (error) {
    console.error('Error fetching portfolio context:', error.message);
    return null; // Return null if portfolio data unavailable
  }
}

// Call Perplexity API with or without portfolio context
async function callPerplexityAPI(question, portfolioContext = null) {
  const systemPrompt = `You are a professional portfolio analysis assistant for Dhanalysis platform.

CRITICAL RULES:
1. NEVER give direct buy/sell recommendations
2. ALWAYS include disclaimer that this is not financial advice
3. Present multiple perspectives (pros and cons)
4. Use phrases like: "Consider...", "Factors to evaluate...", "General principles suggest..."
5. Encourage consulting SEBI-registered advisors
6. Frame predictions as scenarios, not certainties
7. Focus on education and analysis, not advice

ALLOWED:
✓ Explain investment concepts
✓ Identify risks and patterns
✓ Explain financial metrics
✓ Present general investment principles
✓ Discuss hypothetical scenarios

NOT ALLOWED:
✗ "Buy this stock"
✗ "Sell that stock"
✗ "This will go up"
✗ Guarantees or promises
✗ Specific tax advice

Always end responses with: "⚠️ This is informational only. Consult a SEBI-registered advisor for personalized advice."`;

  // Build user message with optional portfolio context
  let userMessage = question;
  if (portfolioContext) {
    userMessage = `${portfolioContext}\n\nUSER QUESTION: ${question}`;
  }

  const response = await axios.post('https://api.perplexity.ai/chat/completions', {
    model: 'sonar-pro',
    messages: [
      {
        role: 'system',
        content: systemPrompt
      },
      {
        role: 'user',
        content: userMessage
      }
    ],
    temperature: 0.3,
    max_tokens: 700
  }, {
    headers: {
      'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
      'Content-Type': 'application/json'
    }
  });

  const choice = response.data.choices[0];
  return {
    answer: choice.message.content,
    tokensUsed: response.data.usage?.total_tokens || 0,
    sources: response.data.citations || []
  };
}

export async function handleChat(req, res) {
  try {
    const { userId, question } = req.body;

    if (!userId || !question || question.trim().length < 3) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request: userId and question (min 3 chars) required.'
      });
    }

    const currentMonth = new Date().toISOString().slice(0, 7);

    console.log(`Chat request from user: ${userId}, question: ${question}`);

    // Fetch portfolio context
    const portfolioContext = await getPortfolioContext(userId);
    
    if (portfolioContext) {
      console.log('Portfolio context loaded successfully');
    } else {
      console.log('No portfolio context available - answering as general question');
    }

    // Call Perplexity with context
    const aiResponse = await callPerplexityAPI(question, portfolioContext);

    const chatRecord = new ChatHistory({
      userId,
      question: question.trim(),
      answer: aiResponse.answer,
      sources: aiResponse.sources,
      tokensUsed: aiResponse.tokensUsed,
      month: currentMonth
    });

    await chatRecord.save();

    return res.json({
      success: true,
      answer: aiResponse.answer,
      sources: aiResponse.sources,
      timestamp: chatRecord.timestamp,
      hasPortfolioContext: !!portfolioContext,
      message: 'Response generated successfully'
    });

  } catch (error) {
    console.error('handleChat Error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to process your question. Try again later.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

export async function getChatHistory(req, res) {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit) || 20;

    const history = await ChatHistory.find({ userId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .select('question answer sources timestamp');

    return res.json({
      success: true,
      count: history.length,
      conversations: history
    });

  } catch (error) {
    console.error('getChatHistory Error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch chat history'
    });
  }
}
