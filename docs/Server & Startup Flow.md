# Dhanalysis — Server & Startup Flow

## Overview

When you run `node server.js`, the app goes through a strict boot sequence before it accepts a single request. If any step fails, the process exits immediately.

```
node server.js
      │
      ▼
 env.js (validate)
      │
      ▼
  app.js (middleware)
      │
      ▼
  connectDB()
      │
      ▼
  startCron()
      │
      ▼
  app.listen()
      │
      ▼
  Routes mounted
      │
      ▼
  404 + Error handlers
```

---

## Step 1 — Environment Validation (`config/env.js`)

**Imported first, before anything else.**

```js
import './config/env.js'; // MUST be first line in server.js
```

What it does:
1. Runs `dotenv.config()` → loads `.env` file into `process.env`
2. Checks a hardcoded `required` list:
   - `MONGO_URI` — MongoDB connection string
   - `CORS_ORIGINS` — comma-separated allowed frontend URLs
   - `JWT_SECRET` — signs access tokens
   - `JWT_REFRESH_SECRET` — signs refresh tokens
3. If **any** are missing → logs the missing names → `process.exit(1)`
4. Parses `CORS_ORIGINS` string → splits by comma → array of allowed origins
5. Exports a single `config` object used by all other files

**Why fail fast?** Better to crash at boot with a clear message than to silently fail mid-request when a route actually needs the variable.

Config also holds (not required, optional):
- `RESEND` — email service keys
- `GEMINI_API_KEY`, `GROQ_API_KEY` — AI providers
- `GMAIL_USER`, `GMAIL_APP_PASSWORD` — SMTP fallback

---

## Step 2 — Express App Setup (`app.js`)

Creates the Express instance and attaches **global middleware** (no routes here).

### CORS
```js
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);          // curl, mobile, server-to-server
    if (config.CORS_ORIGINS.includes(origin)) return callback(null, true);
    return callback(new Error(`CORS: origin '${origin}' not allowed`));
  },
  credentials: true,   // allows cookies to be sent cross-origin
}));
```
- `credentials: true` is required because the frontend sends JWT in cookies
- Allowed origins come from `config.CORS_ORIGINS` (loaded from env)

### Body Parsers
```js
app.use(express.json());                        // parse JSON request bodies
app.use(express.urlencoded({ extended: true })); // parse form data
app.use(cookieParser());                         // parse cookies (refresh token)
```

### Rate Limiter
```js
app.use('/api', apiLimiter);
```
Three tiers defined in `middleware/rateLimiter.js`:

| Limiter | Window | Limit (prod) | Applied to |
|---|---|---|---|
| `apiLimiter` | 15 min | 200 req/IP | All `/api/*` routes |
| `aiLimiter` | 60 min | 10 req/IP | `/api/ai/*` only |
| `authLimiter` | 1 min | 5 req/IP | `/api/auth/*` only |

In development the global limit is raised to 1000 so testing isn't blocked.

### Health Check
```js
app.get('/', (_req, res) => res.json({ status: 'ok', env: config.NODE_ENV }));
```
Render's uptime monitor pings this to confirm the server is alive.

---

## Step 3 — Database Connection (`config/db.js`)

```js
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB connected");
  } catch (err) {
    console.error("❌ MongoDB connection error:", err.message);
    process.exit(1);
  }
};
```

- Called **before** `app.listen()` — no requests handled until DB is ready
- Uses `MONGO_URI` from env (MongoDB Atlas connection string)
- On failure → `process.exit(1)` — server won't start with no DB

Mongoose modern defaults (v6+) no longer need `useNewUrlParser` / `useUnifiedTopology` — those options are removed from the active code (old version is commented out above).

---

## Step 4 — Firebase Admin (`config/firebase.js`)

```js
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId:   config.FIREBASE.projectId,
      clientEmail: config.FIREBASE.clientEmail,
      privateKey:  config.FIREBASE.privateKey,
    }),
  });
}
```

- `!admin.apps.length` guard prevents re-initialisation if the file is imported multiple times
- Firebase Admin is used by `authMiddleware` to verify Firebase ID tokens (login/signup flow)
- Credentials come from `config.FIREBASE.*` (env vars)

---

## Step 5 — Route Mounting (`server.js`)

Routes are registered after middleware, under `/api` prefixes:

```js
app.use('/api/users',      userRoutes);       // register, profile
app.use('/api/investments', investmentRoutes); // add, edit, delete, FIFO sell
app.use('/api/portfolio',  portfolioRoutes);  // summary, history, allocation
app.use('/api/market',     marketRoutes);     // live prices, NIFTY
app.use('/api/analytics',  analyticsRoutes);  // rolling metrics, correlations
app.use('/api/ai',         aiRoutes);         // AI insights (rate limited)
app.use('/api/auth',       authRoutes);       // login, refresh token
```

**Dev-only endpoints** (removed in production):
- `POST /api/dev/trigger-snapshot` — manually runs the cron job (useful on Render where cron time is hard to test)
- `POST /api/dev/test-email` — sends a test email to any address

---

## Step 6 — Cron Job (`jobs/dailySnapshotCron.js`)

Started immediately after DB connects, before `app.listen`.

### Schedule
```js
cron.schedule('35 15 * * 1-5', runDailyJob, { timezone: 'Asia/Kolkata' });
// Mon-Fri at 3:35 PM IST — 5 minutes after NSE closes at 3:30 PM
```

### What `runDailyJob` does

```
1. Get all userIds that have investments (Investment.distinct)
       │
2. Collect all unique symbols across all users
       │
3. bulkRefresh(uniqueSymbols) → ONE API call batch for all symbols
   stores prices in StockMetadata + priceHistory
       │
4. For each user (sequential):
   └─ createSnapshotForUser(userId, priceMap, today)
         │
         ├─ Skip if DailyReport already exists for today
         ├─ calculatePortfolioMetrics(investments, priceMap)
         ├─ calculateXIRR(investments, currentValue, today)
         ├─ calculateStockPerformance (uses yesterday's snapshot)
         ├─ calculateDailyChanges (cash-flow-free daily return)
         ├─ calculateDrawdown (peak return tracking)
         ├─ calculateBenchmarkComparison (vs NIFTY)
         └─ DailyReport.create(...)
       │
5. Send emails IN PARALLEL (Promise.allSettled)
   └─ sendEmailForUser(userId, today)
         ├─ Skip if no email or notifications disabled
         ├─ Load today's snapshot
         └─ sendPortfolioEmail(email, name, snapshot)
```

**Key design — shared price map:**  
Prices are fetched once for ALL users together. If 100 users all hold RELIANCE.NS, the Yahoo Finance API is called only once. Each user's snapshot then reads from the in-memory `priceMap`.

**Sequential snapshots, parallel emails:**  
Snapshots are sequential to avoid hammering MongoDB. Emails use `Promise.allSettled` so one failed email doesn't block the rest.

---

## Step 7 — Auth Middleware (`middleware/authMiddleware.js`)

Applied per-route via `verifyToken`:

```js
export const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return 401;

  const token = authHeader.split(' ')[1];
  const decoded = jwt.verify(token, config.JWT.secret);

  req.user = { uid: decoded.uid, email: decoded.email };
  next();
};
```

- Reads `Authorization: Bearer <token>` header
- Verifies JWT with `JWT_SECRET`
- Attaches `req.user` so controllers can read `req.user.uid`
- `TokenExpiredError` → returns `{ expired: true }` so frontend knows to try refresh

---

## Step 8 — Error Handling (`middleware/errorMiddleware.js`)

Registered **last** in `server.js` — Express only routes here if no earlier handler matched.

```js
// 404 — route doesn't exist
export const notFound = (req, res, next) => {
  res.status(404).json({ error: `Route not found: ${req.originalUrl}` });
};

// 500 — unhandled error thrown anywhere
export const errorHandler = (err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode).json({
    error: err.message,
    stack: NODE_ENV !== 'production' ? err.stack : undefined,
  });
};
```

Stack trace is only included in development — never exposed in production.

---

## Full Boot Sequence (with timing)

```
node server.js
  │
  ├─ [sync]  env.js         → validate env vars, process.exit if missing
  ├─ [sync]  app.js         → create Express, attach CORS + body parsers + rate limiter
  │
  └─ startServer() [async]
        │
        ├─ await connectDB()        → Mongoose connects to MongoDB Atlas
        ├─ startDailySnapshotCron() → schedules Mon-Fri 3:35 PM IST cron
        └─ app.listen(PORT)
              │
              ├─ /api/users → userRoutes
              ├─ /api/investments → investmentRoutes
              ├─ /api/portfolio → portfolioRoutes
              ├─ /api/market → marketRoutes
              ├─ /api/analytics → analyticsRoutes
              ├─ /api/ai → aiRoutes
              ├─ /api/auth → authRoutes
              ├─ [dev] /api/dev/trigger-snapshot
              ├─ [dev] /api/dev/test-email
              ├─ notFound (404 handler)
              └─ errorHandler (500 handler)
```

---

## Key Files Map

| File | Responsibility |
|---|---|
| `server.js` | Entry point — ties everything together |
| `app.js` | Express instance + global middleware |
| `config/env.js` | Load + validate all env vars |
| `config/db.js` | Mongoose connection |
| `config/firebase.js` | Firebase Admin SDK init |
| `middleware/authMiddleware.js` | JWT verification per route |
| `middleware/rateLimiter.js` | 3 rate limit tiers |
| `middleware/errorMiddleware.js` | 404 + global error handler |
| `jobs/dailySnapshotCron.js` | Mon-Fri 3:35 PM snapshot + email job |
