// backend/services/stockService.js
// Thin re-export shim — all callers keep working while the real logic
// now lives in alphaVantageService.js.

export { getBatchStockPrices, getStockQuote, toBSESymbol } from './alphaVantageService.js';
