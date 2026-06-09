// backend/services/sectorService.js
// Returns sector/industry metadata for Indian stocks.
//
// Why hardcoded?
//   Yahoo Finance is blocked on Render and burns API quota.
//   Sector data rarely changes — RELIANCE is always in Energy.
//   A hardcoded map + MongoDB cache is the correct solution here.
//
// Flow:
//   1. Check MongoDB StockMetadata (persists across restarts)
//   2. If not found, look up in SECTOR_MAP below
//   3. Save result to MongoDB so future lookups are instant

import StockMetadata from '../models/StockMetadata.js';
import { SECTOR_CACHE_TTL_DAYS } from '../config/constants.js';

// ── Hardcoded sector map for common NSE/BSE stocks ───────────────────────────
// Add more symbols here as needed. Symbol format matches what's stored in DB.
const SECTOR_MAP = {
  // Energy
  'RELIANCE.NS':    { sector: 'Energy',               industry: 'Oil & Gas Refining',      name: 'Reliance Industries' },
  'ONGC.NS':        { sector: 'Energy',               industry: 'Oil & Gas Exploration',    name: 'ONGC' },
  'NTPC.NS':        { sector: 'Utilities',            industry: 'Electric Utilities',       name: 'NTPC' },
  'POWERGRID.NS':   { sector: 'Utilities',            industry: 'Electric Utilities',       name: 'Power Grid Corp' },

  // Technology
  'TCS.NS':         { sector: 'Technology',           industry: 'IT Services',              name: 'Tata Consultancy Services' },
  'INFY.NS':        { sector: 'Technology',           industry: 'IT Services',              name: 'Infosys' },
  'WIPRO.NS':       { sector: 'Technology',           industry: 'IT Services',              name: 'Wipro' },
  'HCLTECH.NS':     { sector: 'Technology',           industry: 'IT Services',              name: 'HCL Technologies' },
  'TECHM.NS':       { sector: 'Technology',           industry: 'IT Services',              name: 'Tech Mahindra' },
  'LTIM.NS':        { sector: 'Technology',           industry: 'IT Services',              name: 'LTIMindtree' },

  // Banking & Finance
  'HDFCBANK.NS':    { sector: 'Financial Services',   industry: 'Private Sector Bank',      name: 'HDFC Bank' },
  'ICICIBANK.NS':   { sector: 'Financial Services',   industry: 'Private Sector Bank',      name: 'ICICI Bank' },
  'KOTAKBANK.NS':   { sector: 'Financial Services',   industry: 'Private Sector Bank',      name: 'Kotak Mahindra Bank' },
  'AXISBANK.NS':    { sector: 'Financial Services',   industry: 'Private Sector Bank',      name: 'Axis Bank' },
  'SBIN.NS':        { sector: 'Financial Services',   industry: 'Public Sector Bank',       name: 'State Bank of India' },
  'BAJFINANCE.NS':  { sector: 'Financial Services',   industry: 'NBFC',                     name: 'Bajaj Finance' },
  'BAJAJFINSV.NS':  { sector: 'Financial Services',   industry: 'NBFC',                     name: 'Bajaj Finserv' },

  // Automobile
  'TATAMOTORS.NS':  { sector: 'Automobile',           industry: 'Auto - Vehicles',          name: 'Tata Motors' },
  'MARUTI.NS':      { sector: 'Automobile',           industry: 'Auto - Vehicles',          name: 'Maruti Suzuki' },
  'M&M.NS':         { sector: 'Automobile',           industry: 'Auto - Vehicles',          name: 'Mahindra & Mahindra' },
  'HEROMOTOCO.NS':  { sector: 'Automobile',           industry: 'Two Wheelers',             name: 'Hero MotoCorp' },
  'BAJAJ-AUTO.NS':  { sector: 'Automobile',           industry: 'Two Wheelers',             name: 'Bajaj Auto' },
  'EICHERMOT.NS':   { sector: 'Automobile',           industry: 'Two Wheelers',             name: 'Eicher Motors' },

  // Metals & Mining
  'TATASTEEL.NS':   { sector: 'Metals & Mining',      industry: 'Iron & Steel',             name: 'Tata Steel' },
  'JSWSTEEL.NS':    { sector: 'Metals & Mining',      industry: 'Iron & Steel',             name: 'JSW Steel' },
  'HINDALCO.NS':    { sector: 'Metals & Mining',      industry: 'Aluminium',                name: 'Hindalco Industries' },
  'VEDL.NS':        { sector: 'Metals & Mining',      industry: 'Diversified Metals',       name: 'Vedanta' },
  'COALINDIA.NS':   { sector: 'Metals & Mining',      industry: 'Coal',                     name: 'Coal India' },

  // Consumer Goods / FMCG
  'HINDUNILVR.NS':  { sector: 'Consumer Goods',       industry: 'FMCG',                     name: 'Hindustan Unilever' },
  'ITC.NS':         { sector: 'Consumer Goods',       industry: 'FMCG - Tobacco',           name: 'ITC' },
  'NESTLEIND.NS':   { sector: 'Consumer Goods',       industry: 'FMCG - Food',              name: 'Nestle India' },
  'BRITANNIA.NS':   { sector: 'Consumer Goods',       industry: 'FMCG - Food',              name: 'Britannia Industries' },

  // Healthcare & Pharma
  'SUNPHARMA.NS':   { sector: 'Healthcare',           industry: 'Pharmaceuticals',          name: 'Sun Pharmaceutical' },
  'DRREDDY.NS':     { sector: 'Healthcare',           industry: 'Pharmaceuticals',          name: "Dr Reddy's Laboratories" },
  'CIPLA.NS':       { sector: 'Healthcare',           industry: 'Pharmaceuticals',          name: 'Cipla' },
  'APOLLOHOSP.NS':  { sector: 'Healthcare',           industry: 'Hospitals',                name: 'Apollo Hospitals' },
  'DIVISLAB.NS':    { sector: 'Healthcare',           industry: 'Pharmaceuticals',          name: "Divi's Laboratories" },

  // Infrastructure & Construction
  'LT.NS':          { sector: 'Infrastructure',       industry: 'Engineering & Construction', name: 'Larsen & Toubro' },
  'ULTRACEMCO.NS':  { sector: 'Infrastructure',       industry: 'Cement',                   name: 'UltraTech Cement' },
  'ADANIPORTS.NS':  { sector: 'Infrastructure',       industry: 'Ports & Shipping',         name: 'Adani Ports' },
  'ADANIENT.NS':    { sector: 'Infrastructure',       industry: 'Diversified',              name: 'Adani Enterprises' },

  // Telecom
  'BHARTIARTL.NS':  { sector: 'Telecom',              industry: 'Telecom Services',         name: 'Bharti Airtel' },

  // ETFs (track indices, no sector)
  'NIFTYBEES.NS':   { sector: 'ETF',                  industry: 'Index ETF - NIFTY 50',     name: 'Nippon India ETF NIFTY 50 BeES' },
  'JUNIORBEES.NS':  { sector: 'ETF',                  industry: 'Index ETF - NIFTY Next 50', name: 'Nippon India ETF NIFTY Next 50' },
  'GOLDBEES.NS':    { sector: 'ETF',                  industry: 'Gold ETF',                  name: 'Nippon India Gold BeES' },
  'SILVERBEES.NS':  { sector: 'ETF',                  industry: 'Silver ETF',                name: 'Nippon India Silver ETF' },
};

// ── Lookup helpers ────────────────────────────────────────────────────────────

/**
 * getStockSector
 * Checks MongoDB first, then falls back to SECTOR_MAP, then returns 'Others'.
 * Saves to MongoDB so the next lookup is instant.
 */
export const getStockSector = async (symbol) => {
  try {
    // 1. Check MongoDB cache
    const cached = await StockMetadata.findOne({ symbol: symbol.toUpperCase() });
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - SECTOR_CACHE_TTL_DAYS);

    if (cached?.sector && cached.updatedAt > cutoff) {
      return { sector: cached.sector, industry: cached.industry, name: cached.name };
    }

    // 2. Look up in hardcoded map
    const mapped = SECTOR_MAP[symbol] || SECTOR_MAP[symbol.toUpperCase()];
    const data = mapped || { sector: 'Others', industry: 'N/A', name: symbol.replace('.NS', '') };

    // 3. Persist to MongoDB (upsert — don't overwrite price fields)
    await StockMetadata.findOneAndUpdate(
      { symbol: symbol.toUpperCase() },
      { $set: { sector: data.sector, industry: data.industry, name: data.name } },
      { upsert: true, new: true }
    );

    return data;
  } catch (err) {
    console.error(`⚠️  getStockSector error for ${symbol}:`, err.message);
    return { sector: 'Others', industry: 'N/A', name: symbol };
  }
};

/**
 * getBatchSectors
 * Returns a map of { symbol → { sector, industry, name } } for all given symbols.
 * All lookups are from MongoDB/hardcoded — zero API calls.
 */
export const getBatchSectors = async (symbols) => {
  const result = {};
  await Promise.all(
    symbols.map(async (symbol) => {
      result[symbol] = await getStockSector(symbol);
    })
  );
  return result;
};
