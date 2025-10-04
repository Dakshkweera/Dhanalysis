# Investment Tracker API

Simple REST API for portfolio tracking.

---

## 🚀 Setup

npm install
npm start

text

Server runs at: `http://localhost:5000`

---

## 📚 API Endpoints

**Base URL:** `http://localhost:5000/api`

---

## User

### Create User
POST /users/create

text
**Body:**
{
"uid": "firebase_user_id",
"email": "user@example.com",
"name": "John Doe"
}

text

---

## Investments

### Add Investment
POST /investments/add-investment

text
**Body:**
{
"userId": "firebase_user_id",
"symbol": "TCS.NS",
"type": "Stock",
"quantity": 10,
"buyPrice": 3500,
"buyDate": "2025-10-01"
}

text

**Types:** `"Stock"`, `"ETF"`, `"Mutual Fund"`

---

### Get All Investments
GET /investments/:userId

text

---

### Edit Investment
PUT /investments/edit/:investmentId

text
**Body:** (same as add investment)

---

### Delete Investment
DELETE /investments/delete/:id

text

---

## Portfolio

### Get Summary
GET /portfolio/summary?userId={userId}

text

**Response:**
{
"success": true,
"summary": {
"totalInvested": 126100,
"currentValue": 145380,
"profitLoss": 19280,
"roi": 15.29,
"cagr": 14.8,
"xirr": 25.4,
"holdingPeriodDays": 46,
"totalHoldings": 9
},
"topPerformers": {
"best": {
"symbol": "TCS.NS",
"roi": 13.87
},
"worst": {
"symbol": "RELIANCE.NS",
"roi": -5.2
}
},
"benchmark": {
"nifty50Value": 24894.25,
"niftyReturnSinceStart": 1.61,
"outperformance": 13.68
}
}

text

---

### Get History (for charts)
GET /portfolio/history?userId={userId}&days=30

text

**Response:**
{
"success": true,
"data": [
{
"date": "2025-10-01",
"portfolioValue": 140000,
"totalInvested": 126100,
"roi": 11.02,
"nifty50": 25235
}
]
}

text

---

### Get Allocation (for pie charts)
GET /portfolio/allocation?userId={userId}

text

**Response:**
{
"success": true,
"byStock": [
{
"symbol": "TCS.NS",
"name": "Tata Consultancy Services",
"currentValue": 39855,
"allocation": 27.41,
"roi": 13.87
}
],
"bySector": [
{
"sector": "Technology",
"allocation": 47.12,
"roi": 14.17
}
]
}

text

---

### Create Snapshot
POST /portfolio/snapshot

text
**Body:**
{
"userId": "firebase_user_id"
}

text

---

## 📝 Quick Notes

### Stock Symbols
- Indian stocks: Add `.NS` → `TCS.NS`, `INFY.NS`
- Format must be exact

### Validation
- All fields required
- Quantity & price must be positive
- Date cannot be in future
- Stock symbol must exist

### Response Format
All responses include `success: true/false`

**Success:**
{ "success": true, "data": {...} }

text

**Error:**
{
"success": false,
"error": "Error message",
"suggestion": "What to do"
}

text

---

## 🧪 Test Data

Use these symbols:
- `TCS.NS` - TCS
- `INFY.NS` - Infosys
- `RELIANCE.NS` - Reliance
- `HDFCBANK.NS` - HDFC Bank
- `WIPRO.NS` - Wipro

---

## 🔐 Auth (Future)

Currently: Pass `userId` in query/body

Production: Will use Firebase tokens
headers: {
'Authorization': 'Bearer ' + firebaseToken
}

text

---

## ⚡ Features

✅ Real-time stock prices (Yahoo Finance)  
✅ Portfolio metrics (ROI, XIRR, CAGR)  
✅ NIFTY 50 benchmark comparison  
✅ Daily snapshots (cron: Mon-Fri 6 PM)  
✅ Stock validation  
✅ Error handling  