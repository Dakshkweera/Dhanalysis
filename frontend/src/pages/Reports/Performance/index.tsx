import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import TimePeriodSelector from '../../../components/reports/TimePeriodSelector';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, Cell
} from 'recharts';

function Performance() {
  const [selectedPeriod, setSelectedPeriod] = useState('1Y');
  const [loading, setLoading] = useState(true);
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [investments, setInvestments] = useState<any[]>([]);

  // For daily returns bar chart sliding
  const BAR_WINDOW_SIZE = 30;
  const [barStart, setBarStart] = useState(0);

  useEffect(() => {
    setBarStart(0);
    fetchData();
  }, [selectedPeriod]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const userId = localStorage.getItem('userId');
      const token = localStorage.getItem('firebaseToken');
      if (!userId || !token) {
        toast.error('Please login again');
        return;
      }
      const days = getPeriodDays(selectedPeriod);
      
      // Fetch history snapshots
      const historyRes = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/portfolio/history?userId=${userId}&days=${days}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      if (!historyRes.ok) throw new Error(`HTTP ${historyRes.status}: ${historyRes.statusText}`);
      const historyData = await historyRes.json();
      
      // Fetch investments
      const investmentsRes = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/investments/${userId}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      if (!investmentsRes.ok) throw new Error(`Failed to fetch investments`);
      const investmentsData = await investmentsRes.json();
      
      if (historyData.success && historyData.data && historyData.data.length > 0) {
        setSnapshots(historyData.data);
      } else {
        setSnapshots([]);
      }
      
      if (investmentsData.investments && Array.isArray(investmentsData.investments)) {
        setInvestments(investmentsData.investments);
      } else {
        setInvestments([]);
      }
    } catch (err: any) {
      console.error('Fetch error:', err);
      toast.error(err.message || 'Failed to load performance data');
      setSnapshots([]);
      setInvestments([]);
    } finally {
      setLoading(false);
    }
  };

  const getPeriodDays = (period: string): number => {
    const periodMap: { [key: string]: number } = {
      '1M': 30, '3M': 90, '6M': 180, '1Y': 365,
      '3Y': 1095, '5Y': 1825, 'All': 10000
    };
    return periodMap[period] || 365;
  };

  // --- 1. Portfolio XIRR vs NIFTY cumulative return (line) ---
  const performanceData = (() => {
    if (snapshots.length === 0) return [];
    let lastXirr = 0;
    const niftyStart = snapshots[0].nifty50 || 100;
    return snapshots.map((snap: any) => {
      const trailingXirr = (snap.xirr ?? lastXirr);
      lastXirr = (snap.xirr ?? lastXirr);
      const nifty = snap.nifty50 ?? niftyStart;
      const niftyTrailingPct = ((nifty - niftyStart) / niftyStart) * 100;
      return {
        date: snap.date?.slice(5),
        xirr: Number(trailingXirr),
        nifty: Number(niftyTrailingPct),
      };
    });
  })();

  // --- 2. Daily returns bar chart ---
  const returnsData = (() => {
    if (snapshots.length === 0) return [];
    let lastPortfolio = 0, lastNifty = 0;
    return snapshots.map((snap: any) => {
      const portfolioRet = snap.dailyReturn ?? lastPortfolio;
      lastPortfolio = snap.dailyReturn ?? lastPortfolio;
      const niftyRet = snap.niftyDailyReturn ?? lastNifty;
      lastNifty = snap.niftyDailyReturn ?? lastNifty;
      return {
        date: snap.date?.slice(5),
        portfolio: Number(portfolioRet),
        nifty: Number(niftyRet),
      };
    });
  })();

  // --- 3. Stock-wise performance for selected period (OPTIMIZED LOGIC) ---
  const periodStockData = (() => {
    if (snapshots.length === 0 || investments.length === 0) return [];
    
    const periodDays = getPeriodDays(selectedPeriod);
    const today = new Date();
    const periodStartDate = new Date(today.getTime() - periodDays * 24 * 60 * 60 * 1000);
    
    // Find period start snapshot (first snapshot on or after period start date)
    const periodStartSnap = snapshots.find((snap: any) => 
      new Date(snap.date) >= periodStartDate
    ) || snapshots[0];
    
    // Helper: get price for a stock from snapshot
    const getPriceFromSnapshot = (snapshot: any, symbol: string) => {
      if (!snapshot || !snapshot.stockPerformance) return null;
      const stock = snapshot.stockPerformance.find((s: any) => s.symbol === symbol);
      return stock ? stock.currentPrice : null;
    };
    
    // Group by symbol and calculate period return
    const stockReturns: { [symbol: string]: number } = {};
    
    investments.forEach((inv: any) => {
      const symbol = inv.symbol;
      const buyDate = new Date(inv.buyDate);
      const quantity = inv.quantity;
      const buyPrice = inv.buyPrice;
      
      // Use current price directly from investment data (already calculated by backend)
      const currentPrice = parseFloat(inv.currentPrice);
      
      if (!currentPrice) {
        console.warn(`No current price for ${symbol}`);
        return;
      }
      
      let startPrice: number;
      
      // Determine start price based on buy date
      if (buyDate < periodStartDate) {
        // OLD LOT: Bought before period - use period start price from snapshot
        const periodStartPrice = getPriceFromSnapshot(periodStartSnap, symbol);
        if (periodStartPrice) {
          startPrice = periodStartPrice;
        } else {
          // Fallback: if no snapshot price, use buy price
          console.warn(`No period start price for ${symbol}, using buy price`);
          startPrice = buyPrice;
        }
      } else {
        // NEW LOT: Bought within period - use buy price directly
        startPrice = buyPrice;
      }
      
      // Calculate gain/loss for this lot
      const gainLoss = (currentPrice - startPrice) * quantity;
      
      // Add to symbol total
      const cleanSymbol = symbol.replace('.NS', '');
      stockReturns[cleanSymbol] = (stockReturns[cleanSymbol] || 0) + gainLoss;
      
      console.log(`${cleanSymbol}: buyDate=${buyDate.toISOString().slice(0,10)}, inPeriod=${buyDate >= periodStartDate}, (${currentPrice} - ${startPrice}) × ${quantity} = ${gainLoss.toFixed(2)}`);
    });
    
    // Convert to array and sort
    const result = Object.keys(stockReturns)
      .map(symbol => ({
        symbol,
        periodReturn: Number(stockReturns[symbol].toFixed(2)),
      }))
      .sort((a, b) => Math.abs(b.periodReturn) - Math.abs(a.periodReturn));
    
    console.log('Final period stock data:', result);
    return result;
  })();

  return (
    <div className="space-y-8">

      {/* Header and time period selector */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 gap-3">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Performance</h2>
        <TimePeriodSelector selected={selectedPeriod} onChange={setSelectedPeriod} />
      </div>

      {/* Trailing XIRR vs NIFTY trailing return chart */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 mb-4 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-bold mb-4 text-gray-700 dark:text-white">Portfolio XIRR vs NIFTY Cumulative Return</h3>
        {loading ? (
          <div className="h-64 flex items-center justify-center text-gray-500">Loading...</div>
        ) : performanceData.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-gray-500">No data available</div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart margin={{ top: 16, right: 40, left: 8, bottom: 16 }} data={performanceData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" minTickGap={18} />
              <YAxis domain={['auto', 'auto']} tickFormatter={v => `${v.toFixed(2)}%`} />
              <Tooltip formatter={(val) => `${Number(val).toLocaleString()}%`} />
              <Legend />
              <Line type="monotone" dataKey="xirr" name="Portfolio XIRR (%)" stroke="#6366f1" strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="nifty" name="NIFTY Cumulative Return (%)" stroke="#f97316" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Daily Returns Bar Chart with Sliding Window */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 mb-4 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-700 dark:text-white">Daily Returns (% Change)</h3>
          <div className="flex gap-2 items-center">
            <button
              onClick={() => setBarStart(Math.max(0, barStart - BAR_WINDOW_SIZE))}
              disabled={barStart === 0}
              className="px-2 py-1 rounded bg-gray-300 dark:bg-gray-700 text-sm disabled:opacity-50"
            >
              ←
            </button>
            <span className="text-gray-500 dark:text-gray-400 text-xs">
              {`${barStart + 1}-${Math.min(barStart + BAR_WINDOW_SIZE, returnsData.length)} of ${returnsData.length}`}
            </span>
            <button
              onClick={() => setBarStart(Math.min(returnsData.length - BAR_WINDOW_SIZE, barStart + BAR_WINDOW_SIZE))}
              disabled={barStart + BAR_WINDOW_SIZE >= returnsData.length}
              className="px-2 py-1 rounded bg-gray-300 dark:bg-gray-700 text-sm disabled:opacity-50"
            >
              →
            </button>
          </div>
        </div>
        {loading ? (
          <div className="h-64 flex items-center justify-center text-gray-500">Loading...</div>
        ) : returnsData.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-gray-500">No data available</div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={returnsData.slice(barStart, barStart + BAR_WINDOW_SIZE)}
              margin={{ top: 16, right: 40, left: 8, bottom: 16 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" minTickGap={5} />
              <YAxis domain={['auto', 'auto']} tickFormatter={v => `${v.toFixed(2)}%`} />
              <Tooltip formatter={(val) => `${Number(val).toLocaleString()}%`} />
              <Legend />
              <Bar dataKey="portfolio" name="Portfolio Return" fill="#6366f1" />
              <Bar dataKey="nifty" name="NIFTY Return" fill="#f97316" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Stock-wise Profit/Loss for period */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-bold mb-4 text-gray-700 dark:text-white">Stock-wise Performance (Selected Period)</h3>
        {loading ? (
          <div className="h-64 flex items-center justify-center text-gray-500">Loading...</div>
        ) : periodStockData.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-gray-500">No data available</div>
        ) : (
          <ResponsiveContainer width="100%" height={350}>
            <BarChart
              layout="vertical"
              data={periodStockData}
              margin={{ top: 16, right: 40, left: 8, bottom: 16 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tickFormatter={v => `₹${v.toLocaleString()}`} />
              <YAxis type="category" dataKey="symbol" width={100} />
              <Tooltip formatter={(val) => `₹${Number(val).toLocaleString()}`} />
              <Legend />
              <Bar dataKey="periodReturn" name="Profit/Loss (Period)">
                {periodStockData.map((entry: any, idx: number) => (
                  <Cell key={`cell-${idx}`} fill={entry.periodReturn >= 0 ? "#22c55e" : "#f97316"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

export default Performance;
