# Dhanalysis — Interview Guide

---

## 1-Minute Project Explanation (Say This in Interview)

> "I built **Dhanalysis**, a full-stack portfolio analytics platform for Indian stock market investors.
>
> The problem I was solving is — most investors only know their profit or loss, but they don't know *how good* that return actually is. Is a 20% return good? Depends on the risk you took and what NIFTY did in the same period.
>
> So I built a system where users add their stock investments, and every day after market close, my backend automatically takes a snapshot — calculates XIRR, CAGR, Sharpe ratio, drawdown, and compares their portfolio against NIFTY 50.
>
> On top of that, I integrated an AI chatbot powered by Perplexity, where users can ask questions like 'Why is my Sharpe ratio low?' and the AI gets their actual portfolio data as context before answering.
>
> The tech stack is React with TypeScript on the frontend, Node.js with Express on the backend, MongoDB for the database, Firebase for authentication, and the whole thing is deployed on Vercel and Render.
>
> The most interesting engineering challenge was making the analytics cash-flow-free — meaning if a user adds new money today, that shouldn't show as a 'positive return' in volatility calculations. I had to track actual stock price movements separately from capital additions."

---

## Potential Interview Questions & Answers

---

### SECTION 1 — Project Overview

---

**Q1. In one line, what does Dhanalysis do?**

> Dhanalysis tracks your Indian stock portfolio, calculates advanced financial metrics like XIRR, Sharpe ratio, and drawdown, and lets you ask an AI chatbot questions about your own portfolio data.

---

**Q2. What problem does this project solve?**

> Most retail investors only look at profit/loss. They don't know:
> - Is their return good *relative to the risk they took?* (Sharpe Ratio)
> - Are they beating the market? (NIFTY benchmark comparison)
> - What is their true annualized return considering different SIP dates? (XIRR)
>
> Dhanalysis answers all of this automatically, every day after market close.

---

**Q3. Who is the target user?**

> Indian retail equity investors who hold stocks, ETFs, or mutual funds on NSE/BSE and want deeper insight than what broker apps like Zerodha or Groww provide.

---

### SECTION 2 — Technical Architecture

---

**Q4. Walk me through the overall architecture.**

> The system has three layers:
>
> 1. **Frontend** — React + TypeScript SPA deployed on Vercel. Handles login, investment entry, charts, reports, and AI chat.
>
> 2. **Backend** — Node.js + Express REST API deployed on Render. Handles all business logic: price fetching, metric calculation, AI context building, cron jobs.
>
> 3. **Data Layer** — MongoDB Atlas stores users, investments, daily snapshots (DailyReport), chat history, and usage limits. External data comes from Yahoo Finance API (stock prices) and Perplexity API (AI answers).
>
> Every API request is authenticated via Firebase JWT — the frontend sends a Bearer token, and the backend verifies it using Firebase Admin SDK before touching any data.

---

**Q5. Why did you choose MongoDB over a relational database like PostgreSQL?**

> The core reason is the `DailyReport` collection. Each daily snapshot stores a `stockPerformance` array — but every user has a different number of stocks. User A might have 3 stocks, User B might have 20.
>
> In a relational database, this would require a separate `stock_performance` table with foreign keys and JOINs on every read. In MongoDB, it's a naturally embedded document — one query returns everything.
>
> Also, the schema evolved a lot during development (adding XIRR, drawdown, benchmark fields over time). MongoDB's flexible schema made that painless without migrations.

---

**Q6. Why Firebase Auth instead of building your own JWT system?**

> Firebase Auth handles:
> - Password hashing and salting
> - Email verification
> - Token refresh (auto-rotation)
> - Brute force protection
> - OAuth (Google login)
>
> Building all of this from scratch would take weeks and introduce security risks. The backend just calls one line — `admin.auth().verifyIdToken(token)` — and gets a verified `uid`. It's stateless, so no session storage needed either.

---

**Q7. Why Perplexity AI and not OpenAI GPT?**

> Perplexity's `sonar-pro` model has **real-time web search built in**. For financial questions, users might ask "What happened to Infosys stock this week?" or "What is the outlook for IT sector?"
>
> GPT-4 alone would answer based on training data which has a cutoff date. Perplexity can pull live news and recent data.
>
> I also set `temperature: 0.3` — lower temperature means more deterministic, factual responses, which is important for financial data where hallucination is dangerous.

---

### SECTION 3 — Core Features Deep Dive

---

**Q8. Explain the Daily Snapshot system. Why is it needed?**

> The Daily Snapshot is the backbone of the analytics system. Here's why it exists:
>
> Calculating Sharpe ratio, volatility, drawdown, or correlation requires *historical time-series data* — not just today's prices. I need to know what the portfolio was worth on every trading day for the past year.
>
> Every weekday at 3:35 PM IST (5 minutes after NSE closes), a `node-cron` job runs for all users:
> 1. Fetches current prices from Yahoo Finance
> 2. Calculates portfolio value, ROI, CAGR, XIRR
> 3. Calculates daily change vs yesterday's snapshot
> 4. Compares with NIFTY daily return
> 5. Saves everything as a `DailyReport` document
> 6. Sends email digest to the user
>
> This pre-computation makes the Reports page load in milliseconds instead of recalculating everything on demand.

---

**Q9. What is XIRR and how does it differ from CAGR?**

> **CAGR** (Compound Annual Growth Rate) assumes you made one lump-sum investment and held it. Formula:
> `(Final Value / Initial Value)^(1/years) - 1`
>
> **XIRR** (Extended Internal Rate of Return) handles the real world — where investors add money at different dates and amounts (like SIPs or multiple buy orders).
>
> XIRR finds the interest rate `r` where the Net Present Value (NPV) of all cash flows equals zero:
> `Σ [ -investment_i / (1+r)^(days_i/365) ] + currentValue = 0`
>
> This is solved using the **Newton-Raphson iterative method** via the `xirr` npm package.
>
> Example: If you invested ₹10,000 in January and ₹10,000 in September, and your portfolio is worth ₹22,000 in December — CAGR would be misleading, but XIRR correctly annualizes based on when each rupee was deployed.

---

**Q10. What is Sharpe Ratio and how do you calculate it?**

> Sharpe Ratio measures **risk-adjusted return** — how much return you get per unit of risk.
>
> Formula: `(Annualized Return - Risk-Free Rate) / Annualized Volatility`
>
> In my system:
> - Risk-free rate = 4% (approximate Indian T-bill rate)
> - Annualized Return = Average daily return × 252 trading days
> - Annualized Volatility = Standard deviation of daily returns × √252
>
> A Sharpe > 1 is considered good. It means you're earning more than 1 unit of return for every 1 unit of risk.
>
> A portfolio with 20% return but extreme volatility may have a lower Sharpe than one with 15% return and very stable growth.

---

**Q11. What is the cash-flow problem in analytics and how did you solve it?**

> This was the trickiest part of the project.
>
> **The problem:** If I add ₹50,000 to my portfolio today, the portfolio value jumps by ₹50,000. If I naively calculate daily return as `(today's value - yesterday's value) / yesterday's value`, it shows a massive +20% return. But that's not a market return — it's just new capital.
>
> This would corrupt volatility, Sharpe ratio, and drawdown calculations.
>
> **My solution:** Instead of using portfolio value changes, I calculate daily returns from **individual stock price movements**:
> ```
> For each stock present in both today's and yesterday's snapshot:
>   stockReturn = (todayPrice - yesterdayPrice) / yesterdayPrice
>   contribution = stockReturn × (stockValue / totalPortfolioValue)
>
> portfolioDailyReturn = Σ contributions
> ```
>
> This is the same methodology used by professional fund performance attribution. Only stocks present in *both* snapshots are included — newly added stocks are skipped for that day.

---

**Q12. How does the AI chatbot know about the user's portfolio?**

> Before calling Perplexity, the backend builds a "portfolio context" string by making 5 parallel API calls to its own endpoints:
> - `/portfolio/summary` → total invested, current value, XIRR, CAGR
> - `/portfolio/allocation` → each stock's weight, ROI, P/L
> - `/analytics/correlation` → Beta, correlation with NIFTY
> - `/analytics/rolling-metrics` → Sharpe, volatility, win rate
> - `/portfolio/history?days=1` → today's performance
>
> This data is formatted into a 200-300 word structured text and prepended to the user's question. Perplexity then answers with full awareness of that person's actual portfolio.
>
> The system prompt strictly instructs the model: no direct buy/sell recommendations, always add SEBI disclaimer, present multiple perspectives. This is because financial advice is regulated in India.

---

**Q13. How does the usage limit system work for the AI chatbot?**

> There's a `UsageLimit` collection in MongoDB with documents keyed by `{ userId, month }`.
>
> - Free users: 10 questions per calendar month
> - Before every AI call: check `questionsAsked >= questionLimit` → return HTTP 429 if exceeded
> - After successful AI call: increment `questionsAsked` by 1
> - On the 1st of next month, a new document is auto-created (reset happens naturally)
> - Premium flag (`isPremium: true`) bypasses the check entirely
>
> The frontend shows remaining questions count after every response.

---

### SECTION 4 — Security & Edge Cases

---

**Q14. How do you secure the API endpoints?**

> Three layers:
>
> 1. **Authentication** — Every protected route goes through `verifyFirebaseToken` middleware. It extracts the Bearer token from `Authorization` header and calls `admin.auth().verifyIdToken()`. If invalid or expired, returns 401.
>
> 2. **Authorization** — Every database query filters by `userId` (the verified Firebase UID). So even if somehow two users have different tokens, user A can never read user B's investments: `Investment.find({ userId: req.user.uid })`.
>
> 3. **CORS** — The backend has a strict allowlist of origins (Vercel production URL + localhost:5173). Requests from unknown origins are rejected.

---

**Q15. How do you handle market holidays and weekends?**

> Two ways:
>
> 1. The cron job is scheduled `35 15 * * 1-5` — this means Monday through Friday only. So it never runs on weekends.
>
> 2. For analytics that need "yesterday's" data, instead of strictly querying yesterday's date, I query: `DailyReport.findOne({ date: { $lt: today } }).sort({ date: -1 }).limit(1)` — this gets the *most recent* previous snapshot, which might be Friday when queried on Monday. This handles both weekends and NSE holidays correctly.

---

**Q16. What happens if Yahoo Finance is down when the cron runs?**

> The `getBatchStockPrices` function uses `Promise.allSettled` instead of `Promise.all`. This means even if some stocks fail, it still processes the ones that succeeded.
>
> If *all* prices fail, it logs an error and returns an empty map — the snapshot either isn't created or is created with zeroed values rather than crashing the entire cron job.
>
> The `Promise.allSettled` pattern is important here because with `Promise.all`, one failed stock would reject the entire batch.

---

**Q17. How do you handle the case where a user's first investment is very recent (< 7 days)?**

> XIRR requires at least 7 days of data to be meaningful (the Newton-Raphson algorithm can diverge with very short periods). The `xirrService.js` explicitly checks:
> ```js
> if (daysDiff < 7) return null;
> ```
>
> Similarly, the rolling metrics endpoint validates: `if (days < 7 || days > 365)` return 400.
>
> The frontend gracefully shows "N/A" for metrics that aren't available yet rather than showing misleading numbers.

---

### SECTION 5 — Frontend

---

**Q18. How does routing and authentication work on the frontend?**

> React Router v6 with protected routes. The `isAuthenticated()` function checks if `firebaseToken` exists in `localStorage`. Protected routes use this pattern:
>
> ```jsx
> isAuthenticated() ? <AuthLayout><Dashboard /></AuthLayout> : <Navigate to="/login" />
> ```
>
> The `AuthLayout` wrapper renders Sidebar + Header around the page. Public routes (landing, login, signup) render without the layout.
>
> On login, both the Firebase token and `userId` are stored in localStorage. On every API call, the token is sent in the Authorization header.

---

**Q19. Why did you use Recharts for the portfolio chart?**

> Recharts is built specifically for React — it uses React components and hooks, so it integrates naturally. The `AreaChart` with `ResponsiveContainer` gives a mobile-responsive portfolio growth chart out of the box.
>
> I chose `AreaChart` over `LineChart` because the filled area below the line makes it visually easier to see portfolio growth at a glance — standard in financial apps like Zerodha Kite and Groww.
>
> I also built a custom `Tooltip` component that shows Invested vs Current Value vs ROI on hover — something the default tooltip doesn't support.

---

**Q20. What is the Ticker Strip component?**

> It's a live scrolling ticker bar (like stock tickers you see on news channels) that shows real-time prices of key NSE indices and popular stocks. It auto-scrolls horizontally using a CSS animation defined in `ticker.css`. It fetches data from the market endpoint and updates periodically.

---

### SECTION 6 — Deployment & DevOps

---

**Q21. How is the project deployed?**

> - **Frontend** → Vercel. Auto-deploys on every `git push` to main. Vite builds the React app, Vercel serves it as a static site with CDN.
>
> - **Backend** → Render. Node.js server runs 24/7 (required because node-cron must be always running to fire the 3:35 PM snapshot). Render provides a persistent server unlike Vercel serverless functions which time out.
>
> The reason the backend can't be serverless is the cron job — Lambda/Cloud Functions are stateless and can't maintain a scheduled process.

---

**Q22. How do you manage environment variables?**

> Backend uses `dotenv` — `.env` file locally, Render's environment variable settings in production. Variables include: `MONGODB_URI`, `FIREBASE credentials`, `PERPLEXITY_API_KEY`, `EMAIL_PASSWORD`, `BASE_URL`.
>
> Frontend uses Vite's `import.meta.env.VITE_API_BASE_URL` — environment variables prefixed with `VITE_` are exposed to the browser. Set in Vercel project settings for production.

---

### SECTION 7 — What You'd Improve

---

**Q23. What would you improve if you had more time?**

> 1. **WebSockets for live prices** — Currently, the dashboard fetches prices on load. Ideally, prices would push live via WebSocket connections so the portfolio value updates in real-time during market hours.
>
> 2. **Redis caching** — Stock prices are fetched fresh on every API call. A Redis cache with 5-minute TTL would reduce Yahoo Finance API calls dramatically and speed up response times.
>
> 3. **Proper time-series database** — MongoDB works, but TimescaleDB or InfluxDB is purpose-built for time-series data (daily snapshots). It would make range queries and aggregations faster.
>
> 4. **Import from broker** — Right now users manually enter investments. Integration with Zerodha Kite API or CDSL CAMS would auto-import all holdings.
>
> 5. **Goal tracking** — Let users set a target portfolio value or XIRR goal and track progress toward it.

---

## Quick Reference — Tech Stack Summary

| What | Technology | Why |
|---|---|---|
| Frontend Framework | React + TypeScript | Type-safety, component reuse |
| Build Tool | Vite | Fast HMR, faster than CRA |
| Styling | Tailwind CSS | Utility-first, no custom CSS |
| Charts | Recharts | React-native, responsive |
| Routing | React Router v6 | Nested routes for Reports |
| Auth | Firebase Auth | No custom JWT plumbing |
| Backend | Node.js + Express 5 | Same language as frontend |
| Database | MongoDB + Mongoose | Flexible schema, embedded docs |
| Stock Prices | yahoo-finance2 | Free NSE/BSE price data |
| Scheduler | node-cron | Daily snapshots at market close |
| AI | Perplexity sonar-pro | Real-time web search + LLM |
| Email | Nodemailer | Daily portfolio digest |
| Frontend Deploy | Vercel | Auto-deploy, CDN |
| Backend Deploy | Render | Always-on for cron jobs |

---

## Key Numbers to Remember

- **10** questions/month — free AI tier limit
- **3:35 PM IST, Mon-Fri** — daily snapshot cron schedule
- **252** trading days/year — used in Sharpe & volatility annualization
- **4%** — risk-free rate used in Sharpe ratio (Indian T-bill rate)
- **7 days** minimum — required before XIRR becomes meaningful
- **5 parallel API calls** — made to build AI portfolio context
- **3 collections** — core data: User, Investment, DailyReport


Now I have a thorough understanding of the entire project. Here's your complete interview-ready breakdown:

---

# Dhanalysis — Complete Interview Guide

## What is this project?

**Dhanalysis** is a **full-stack Indian stock portfolio tracker & analyzer**. Users log their stock/ETF/MF investments, and the platform tracks real-time value, calculates advanced financial metrics (XIRR, CAGR, Sharpe ratio, drawdown), compares performance against NIFTY 50, and lets users ask AI questions about their own portfolio.

---

## Tech Stack — What & Why

| Layer | Tech | Why Used |
|---|---|---|
| **Frontend** | React + TypeScript + Vite | Fast SPA, type-safety for financial data |
| **Styling** | Tailwind CSS | Rapid UI without custom CSS |
| **Charts** | Recharts | React-native charting, AreaChart for portfolio growth |
| **Auth (Frontend)** | Firebase Auth (Google/Email) | No custom auth server needed, secure JWT tokens |
| **Backend** | Node.js + Express 5 | JS on both sides, lightweight REST API |
| **Database** | MongoDB + Mongoose | Flexible schema for snapshots + time-series data |
| **Auth (Backend)** | Firebase Admin SDK | Verifies Firebase tokens — stateless, no session store |
| **Stock Prices** | yahoo-finance2 | Free real-time NSE/BSE prices via Yahoo Finance |
| **AI Chat** | Perplexity API (sonar-pro) | LLM with web search built-in for finance queries |
| **Email** | Nodemailer | Daily portfolio digest emails |
| **Scheduler** | node-cron | Daily snapshot at 3:35 PM IST (post market close) |
| **XIRR** | xirr npm package | True annualized return accounting for irregular cash flows |
| **Deployment** | Vercel (frontend) + Render (backend) | Serverless frontend, always-on backend for cron |

---

## High Level Design (HLD)

```
┌──────────────────────────────────────────────────────────────────────┐
│                        USER'S BROWSER                                │
│                                                                      │
│   React SPA (Vite)                                                   │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────────────┐  │
│   │ Landing  │  │Dashboard │  │Reports   │  │  AI Insights      │  │
│   │ /login   │  │/dashboard│  │/reports  │  │  /ai              │  │
│   │ /signup  │  │          │  │overview  │  │  (Chat Interface)  │  │
│   └──────────┘  └──────────┘  │perf/risk │  └───────────────────┘  │
│                               │benchmark │                          │
│                               └──────────┘                          │
└──────────────────┬───────────────────────────────────────────────────┘
                   │ HTTPS REST API  (Bearer Token = Firebase JWT)
                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    NODE.JS / EXPRESS BACKEND (Render)                │
│                                                                      │
│  ┌─────────────────────────────────────────┐                        │
│  │        authMiddleware.js                │                        │
│  │  Firebase Admin → verifyIdToken()       │                        │
│  │  Attaches req.user.uid to every request │                        │
│  └──────────────┬──────────────────────────┘                        │
│                 │                                                    │
│  ┌──────────────▼───────────────────────────────────────────────┐   │
│  │                    ROUTE HANDLERS                            │   │
│  │                                                              │   │
│  │  /api/user         → userController                         │   │
│  │  /api/investments  → investmentController                   │   │
│  │  /api/portfolio    → portfolioController                    │   │
│  │  /api/analytics    → analyticsController                    │   │
│  │  /api/market       → niftyService                           │   │
│  │  /api/ai           → aiController                           │   │
│  └──────────────┬───────────────────────────────────────────────┘   │
│                 │                                                    │
│  ┌──────────────▼───────────────────────────────────────────────┐   │
│  │                    SERVICE LAYER                             │   │
│  │                                                              │   │
│  │  stockService   → yahoo-finance2 (live prices)              │   │
│  │  niftyService   → yahoo-finance2 (^NSEI)                    │   │
│  │  portfolioService → CAGR, P/L, ROI, top performers          │   │
│  │  metricsCalculator → drawdown, daily return, CAGR           │   │
│  │  analyticsService → Sharpe, Volatility, Correlation, Beta   │   │
│  │  xirrService    → XIRR via Newton-Raphson method            │   │
│  │  emailService   → Nodemailer daily digest                   │   │
│  └──────────────┬───────────────────────────────────────────────┘   │
│                 │                                                    │
│  ┌──────────────▼───────────────────────────────────────────────┐   │
│  │               node-cron (3:35 PM IST, Mon-Fri)               │   │
│  │               dailySnapshotCron.js                           │   │
│  │   Fetches prices → Calculates metrics → Saves DailyReport    │   │
│  │   → Sends email digest to each user                          │   │
│  └──────────────────────────────────────────────────────────────┘   │
└──────────────────┬───────────────────────────────────────────────────┘
                   │
         ┌─────────▼────────────────┐      ┌──────────────────────┐
         │   MongoDB Atlas           │      │  External APIs        │
         │                          │      │                       │
         │  Collections:            │      │  yahoo-finance2       │
         │  • User                  │      │  (NSE stock prices)   │
         │  • Investment            │      │                       │
         │  • DailyReport           │      │  Perplexity AI API    │
         │  • ChatHistory           │      │  (sonar-pro model)    │
         │  • UsageLimit            │      │                       │
         │  • MarketBenchmark       │      │  Firebase Auth        │
         │  • StockMetadata         │      │  (token verification) │
         └──────────────────────────┘      └──────────────────────┘
```

---

## Core Feature Flows

### 1. User Authentication Flow
```
User visits /signup
    → Firebase Auth createUserWithEmailAndPassword()
    → POST /api/user/register (saves uid, email, name to MongoDB)
    → Redirect to /onboarding
    
User visits /login
    → Firebase signInWithEmailAndPassword()
    → Gets Firebase JWT token
    → Saves token + userId to localStorage
    → Redirect to /dashboard

Every API call:
    → Frontend: Authorization: Bearer <firebase_jwt>
    → Backend: authMiddleware verifyIdToken() → req.user.uid
```

### 2. Add Investment Flow
```
User fills BuyStockModal
    → POST /api/investments
    → Validates: symbol, type, qty, price, date
    → Saves Investment document to MongoDB
    → Fetches NIFTY data for that buy date (benchmark)
    → Updates user.firstInvestmentDate if earlier
    → Returns {needsProcessing: true}
```

### 3. Daily Snapshot Flow (The Heart of the System)
```
node-cron fires at 3:35 PM IST (Mon-Fri)
    ↓
For each user who has investments:
    1. Get all Investment documents
    2. Call yahoo-finance2 for batch prices → priceMap
    3. Calculate portfolio metrics:
       - totalInvested = Σ(qty × buyPrice)
       - currentValue  = Σ(qty × currentPrice)
       - ROI           = (currentValue - totalInvested) / totalInvested × 100
       - CAGR          = (currentValue/totalInvested)^(1/years) - 1
       - XIRR          = Newton-Raphson on cash flows
    4. Compare with yesterday's snapshot → dailyChange
    5. Compare with NIFTY daily return → beatNifty, outperformance
    6. Calculate per-stock performance (weight, dayChange%)
    7. Calculate drawdown from peak return
    8. Save DailyReport document
    9. Send email digest via Nodemailer
```

### 4. AI Chat Flow
```
User types question in AIInsights page
    → POST /api/ai/chat { userId, question }
    
    1. checkUsageLimit() → 10 questions/month (free tier)
    2. getPortfolioContext():
       - Parallel fetch: /portfolio/summary, /portfolio/allocation,
         /analytics/correlation, /analytics/rolling-metrics, /portfolio/history
       - Builds structured text: "User has ₹X invested, XIRR: Y%..."
    3. callPerplexityAPI(question, portfolioContext)
       - System prompt: SEBI disclaimer, no direct buy/sell advice
       - Model: sonar-pro (has web search + reasoning)
       - Temperature: 0.3 (deterministic financial answers)
    4. incrementUsage() in MongoDB
    5. Save to ChatHistory
    6. Return answer + sources + usage stats
```

### 5. Reports & Analytics Flow
```
User opens /reports/performance
    → GET /api/analytics/rolling-metrics?userId=X&days=30
    
    1. Fetch DailyReport snapshots for last 30 days
    2. Calculate cash-flow-free daily returns:
       (uses stock price movements, not portfolio value changes
        to avoid distortion from new capital additions)
    3. Calculate:
       - Annualized Volatility = stdDev × √252
       - Sharpe Ratio = (annualReturn - 4%) / annualizedVol
       - Max Drawdown = peak return % - current return %
       - Win Rate = positive days / total days × 100
       - Profit Factor = avgGain / avgLoss

User opens /reports/benchmark
    → GET /api/analytics/correlation?userId=X
    
    1. Get portfolio daily returns (stock-weighted)
    2. Get NIFTY daily returns from DailyReport.benchmarkComparison
    3. Pearson correlation = Σ(x-x̄)(y-ȳ) / √[Σ(x-x̄)² × Σ(y-ȳ)²]
    4. Beta = correlation × (portfolioStdDev / niftyStdDev)
```

---

## Key Financial Metrics — What They Mean

| Metric | Formula | What it tells |
|---|---|---|
| **ROI** | (currentValue - invested) / invested × 100 | Simple total return |
| **CAGR** | (finalValue/initialValue)^(1/years) - 1 | Annualized growth rate |
| **XIRR** | Newton-Raphson on irregular cash flows | True annualized return accounting for timing of investments |
| **Sharpe Ratio** | (annualReturn - 4%) / annualizedVol | Risk-adjusted return (>1 is good) |
| **Max Drawdown** | Peak return % - current return % | Worst loss from a peak |
| **Beta** | Corr × (portfolioStdDev / niftyStdDev) | How much your portfolio moves vs NIFTY (1 = same, <1 = less risky) |
| **Volatility** | stdDev of daily returns × √252 | Annualized risk measure |
| **Win Rate** | Positive days / total days | What % of days the portfolio went up |

---

## Database Schema (Key Models)

```
Investment {
  userId, symbol, type (Stock/ETF/MF),
  quantity, buyPrice, buyDate, isProcessed
}

DailyReport {
  userId, date,
  totalInvested, portfolioValue, profitLoss, roi,
  cagr, xirr, absoluteReturn,
  dailyChange { value, %, marketChange },
  stockPerformance [ { symbol, currentPrice, dayChange, weight } ],
  benchmarkComparison { nifty50Value, niftyDailyReturn, beatNifty, outperformance },
  topPerformers { best, worst }
}

ChatHistory { userId, question, answer, sources, tokensUsed, month }
UsageLimit  { userId, month, questionsAsked, questionLimit:10, isPremium }
```

---

## Why These Specific Tech Choices

**Why MongoDB (not PostgreSQL)?**
DailyReport stores `stockPerformance` as an embedded array of objects — schema differs user to user (different number of stocks). MongoDB's flexible document model handles this naturally; SQL would need a separate join table.

**Why Firebase Auth (not JWT yourself)?**
Saves implementing password hashing, token refresh, email verification from scratch. Firebase handles all security. The backend just calls `admin.auth().verifyIdToken()` — one line.

**Why Perplexity (not OpenAI)?**
Perplexity's `sonar-pro` has built-in real-time web search. For financial Q&A, it can pull live market news. OpenAI's GPT alone wouldn't have access to current market data.

**Why DailyReport snapshots (not recalculate on request)?**
Computing XIRR, Sharpe, volatility, and drawdown across years of data on every page load would be too slow. Pre-computed snapshots make the Reports page nearly instant.

**Why cash-flow-free daily returns in analytics?**
If you add ₹10,000 to your portfolio today, portfolio value jumps by ₹10,000 — that's not a "return," it's new capital. The analytics engine separates market movements from capital additions for accurate Sharpe/volatility calculations.

**Why node-cron at 3:35 PM IST specifically?**
NSE closes at 3:30 PM IST. The 5-minute buffer allows Yahoo Finance to update closing prices. Running Mon-Fri skips weekends when markets are closed.

---

## Interview Talking Points

1. **"How does XIRR differ from CAGR?"** — CAGR assumes one lump-sum investment. XIRR accounts for multiple investments at different dates with different amounts (SIP-like). It solves for the rate `r` where NPV of all cash flows = 0.

2. **"How do you prevent unauthorized access?"** — Firebase JWT token sent in every request header. Backend middleware calls Firebase Admin SDK to verify the token cryptographically before any DB query.

3. **"How does the AI know about my portfolio?"** — Before calling Perplexity, the backend makes 5 parallel API calls to its own endpoints, assembles a structured text context (200+ words of portfolio data), and prepends it to the user's question.

4. **"How do you handle market holidays?"** — The cron only runs Mon-Fri. The analytics engine uses "last available snapshot" (not strictly yesterday) to compute daily changes: `DailyReport.findOne({ date: { $lt: today } }).sort({ date: -1 })`.

5. **"What is the usage limit system?"** — MongoDB `UsageLimit` collection tracks questions per `userId + month`. Free users get 10/month. When limit hits, returns HTTP 429 with reset date. Premium flag bypasses this.