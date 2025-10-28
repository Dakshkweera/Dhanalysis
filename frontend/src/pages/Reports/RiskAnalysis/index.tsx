import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import TimePeriodSelector from '../../../components/reports/TimePeriodSelector';
import { TrendingDown, Activity, Target, AlertTriangle, TrendingUp } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area
} from 'recharts';

function RiskAnalysis() {
  const [selectedPeriod, setSelectedPeriod] = useState('1Y');
  const [loading, setLoading] = useState(true);
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [_investments, setInvestments] = useState<any[]>([]);
  const [riskMetrics, setRiskMetrics] = useState<any>(null);

  useEffect(() => {
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
      
      const historyRes = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/portfolio/history?userId=${userId}&days=${days}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      const historyData = await historyRes.json();
      
      const investmentsRes = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/investments/${userId}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      const investmentsData = await investmentsRes.json();
      
      if (historyData.success && historyData.data) {
        setSnapshots(historyData.data);
        calculateRiskMetrics(historyData.data, investmentsData.investments || []);
      }
      if (investmentsData.investments) {
        setInvestments(investmentsData.investments);
      }
    } catch (err: any) {
      console.error('Fetch error:', err);
      toast.error(err.message || 'Failed to load risk data');
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

  const calculateRiskMetrics = (snaps: any[], invs: any[]) => {
    if (snaps.length < 2) {
      setRiskMetrics(null);
      return;
    }

    const xirrValues: number[] = snaps
      .map((snap: any) => snap.xirr)
      .filter((x: any) => x !== null && x !== undefined && !isNaN(x));

    const xirrChanges: number[] = [];
    for (let i = 1; i < xirrValues.length; i++) {
      xirrChanges.push(xirrValues[i] - xirrValues[i - 1]);
    }

    const drawdowns = snaps
      .map((snap: any) => snap.currentDrawdown || 0)
      .filter((d: any) => !isNaN(d));
    const maxDrawdown = Math.min(...drawdowns);

    let annualizedVolatility = 0;
    if (xirrChanges.length > 0) {
      const avgXirrChange = xirrChanges.reduce((a, b) => a + b, 0) / xirrChanges.length;
      const variance = xirrChanges.reduce((sum, change) => 
        sum + Math.pow(change - avgXirrChange, 2), 0) / xirrChanges.length;
      annualizedVolatility = Math.sqrt(variance);
    }

    const riskFreeRate = 4;
    const latestXirr = xirrValues[xirrValues.length - 1] || 0;
    const sharpeRatio = annualizedVolatility > 0 
      ? (latestXirr - riskFreeRate) / annualizedVolatility 
      : 0;

    const totalValue = invs.reduce((sum, inv) => sum + parseFloat(inv.currentValue || 0), 0);
    const sortedHoldings = invs
      .map(inv => ({
        symbol: inv.symbol,
        value: parseFloat(inv.currentValue || 0),
        percent: (parseFloat(inv.currentValue || 0) / totalValue) * 100
      }))
      .sort((a, b) => b.value - a.value);
    const top3Concentration = sortedHoldings.slice(0, 3).reduce((sum, h) => sum + h.percent, 0);

    const portfolioReturns: number[] = [];
    const niftyReturns: number[] = [];
    
    for (let i = 1; i < snaps.length; i++) {
      const prevPort = snaps[i - 1].portfolioValue || 0;
      const currPort = snaps[i].portfolioValue || 0;
      const prevNifty = snaps[i - 1].nifty50 || 0;
      const currNifty = snaps[i].nifty50 || 0;
      
      const portChange = prevPort > 0 ? ((currPort - prevPort) / prevPort) * 100 : 0;
      
      if (prevPort > 0 && prevNifty > 0 && Math.abs(portChange) < 15) {
        portfolioReturns.push((currPort - prevPort) / prevPort);
        niftyReturns.push((currNifty - prevNifty) / prevNifty);
      }
    }

    let beta = 1;
    if (portfolioReturns.length > 10 && niftyReturns.length > 10) {
      const avgPortReturn = portfolioReturns.reduce((a, b) => a + b, 0) / portfolioReturns.length;
      const avgNiftyReturn = niftyReturns.reduce((a, b) => a + b, 0) / niftyReturns.length;
      
      const covariance = portfolioReturns.reduce((sum, pr, i) => 
        sum + (pr - avgPortReturn) * (niftyReturns[i] - avgNiftyReturn), 0) / portfolioReturns.length;
      
      const niftyVariance = niftyReturns.reduce((sum, nr) => 
        sum + Math.pow(nr - avgNiftyReturn, 2), 0) / niftyReturns.length;
      
      beta = niftyVariance > 0 ? covariance / niftyVariance : 1;
    }

    setRiskMetrics({
      maxDrawdown: maxDrawdown.toFixed(2),
      volatility: annualizedVolatility.toFixed(2),
      sharpeRatio: sharpeRatio.toFixed(2),
      concentration: top3Concentration.toFixed(1),
      beta: beta.toFixed(2)
    });
  };

  // Drawdown chart data
  const drawdownData = (() => {
    if (snapshots.length === 0) return [];
    return snapshots.map((snap: any) => ({
      date: snap.date?.slice(5),
      drawdown: snap.currentDrawdown || 0
    }));
  })();

  // Rolling volatility using STOCK PRICES (cash-flow free)
  const rollingVolatilityData = (() => {
    if (snapshots.length < 30) return [];
    const windowSize = 30;
    const result: any[] = [];

    for (let i = windowSize; i < snapshots.length; i++) {
      const window = snapshots.slice(i - windowSize, i);
      const dailyReturns: number[] = [];
      
      // Calculate daily returns from stock price movements
      for (let j = 1; j < window.length; j++) {
        const prevSnap = window[j - 1];
        const currSnap = window[j];
        
        if (!prevSnap.stockPerformance || !currSnap.stockPerformance) continue;
        
        let weightedReturn = 0;
        let totalWeight = 0;
        
        // For each stock in current snapshot
        currSnap.stockPerformance.forEach((currStock: any) => {
          // Find same stock in previous snapshot
          const prevStock = prevSnap.stockPerformance.find(
            (s: any) => s.symbol === currStock.symbol
          );
          
          // Only calculate if stock existed yesterday (skip newly added stocks)
          if (prevStock && prevStock.currentPrice > 0 && currStock.currentPrice > 0) {
            // Calculate stock's price return
            const stockReturn = 
              (currStock.currentPrice - prevStock.currentPrice) / prevStock.currentPrice;
            
            // Weight by portfolio allocation (use current value as weight)
            const weight = currStock.value || 0;
            weightedReturn += stockReturn * weight;
            totalWeight += weight;
          }
        });
        
        // Normalize by total weight to get portfolio return
        if (totalWeight > 0) {
          dailyReturns.push((weightedReturn / totalWeight) * 100);
        }
      }

      // Calculate volatility from daily returns
      if (dailyReturns.length > 5) {
        const avg = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
        const variance = dailyReturns.reduce(
          (sum, r) => sum + Math.pow(r - avg, 2), 0
        ) / dailyReturns.length;
        const volatility = Math.sqrt(variance) * Math.sqrt(252); // Annualized
        
        result.push({
          date: snapshots[i].date?.slice(5),
          volatility: Number(volatility.toFixed(2))
        });
      }
    }

    return result;
  })();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 gap-3">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Risk Analysis</h2>
        <TimePeriodSelector selected={selectedPeriod} onChange={setSelectedPeriod} />
      </div>

      {/* Summary Cards */}
      {loading ? (
        <div className="h-64 flex items-center justify-center text-gray-500">Loading...</div>
      ) : !riskMetrics ? (
        <div className="h-64 flex items-center justify-center text-gray-500">Not enough data</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            
            {/* Maximum Drawdown */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <TrendingDown className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Max Drawdown</h3>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{riskMetrics.maxDrawdown}%</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Worst peak-to-trough decline</p>
            </div>

            {/* Volatility */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <Activity className={`w-8 h-8 ${parseFloat(riskMetrics.volatility) > 30 ? 'text-red-500' : parseFloat(riskMetrics.volatility) > 15 ? 'text-orange-500' : 'text-green-500'}`} />
              </div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">XIRR Volatility</h3>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{riskMetrics.volatility}%</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Return consistency</p>
            </div>

            {/* Sharpe Ratio */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <Target className={`w-8 h-8 ${parseFloat(riskMetrics.sharpeRatio) > 1.5 ? 'text-green-500' : parseFloat(riskMetrics.sharpeRatio) > 1 ? 'text-blue-500' : 'text-orange-500'}`} />
              </div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Sharpe Ratio</h3>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{riskMetrics.sharpeRatio}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Risk-adjusted returns</p>
            </div>

            {/* Concentration Risk */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <AlertTriangle className={`w-8 h-8 ${parseFloat(riskMetrics.concentration) > 60 ? 'text-red-500' : parseFloat(riskMetrics.concentration) > 40 ? 'text-yellow-500' : 'text-green-500'}`} />
              </div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Top 3 Holdings</h3>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{riskMetrics.concentration}%</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Concentration risk</p>
            </div>

            {/* Beta */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <TrendingUp className={`w-8 h-8 ${parseFloat(riskMetrics.beta) < 0.7 ? 'text-blue-500' : parseFloat(riskMetrics.beta) > 1.3 ? 'text-red-500' : 'text-green-500'}`} />
              </div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Beta vs NIFTY</h3>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{riskMetrics.beta}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Market sensitivity</p>
            </div>

          </div>

          {/* Drawdown Chart */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-bold mb-4 text-gray-700 dark:text-white">Drawdown Over Time</h3>
            {drawdownData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-gray-500">No data available</div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={drawdownData} margin={{ top: 16, right: 40, left: 8, bottom: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" minTickGap={18} />
                  <YAxis tickFormatter={v => `${v.toFixed(1)}%`} />
                  <Tooltip formatter={(val) => `${Number(val).toFixed(2)}%`} />
                  <Area 
                    type="monotone" 
                    dataKey="drawdown" 
                    name="Drawdown" 
                    stroke="#ef4444" 
                    fill="#ef4444"
                    fillOpacity={0.3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Shows % below peak value. Closer to 0% = portfolio near all-time high
            </p>
          </div>

          {/* Rolling Volatility Chart - CORRECTED */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-bold mb-4 text-gray-700 dark:text-white">30-Day Rolling Volatility (Market Movements Only)</h3>
            {rollingVolatilityData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-gray-500">Not enough data (need 30+ days)</div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={rollingVolatilityData} margin={{ top: 16, right: 40, left: 8, bottom: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" minTickGap={18} />
                  <YAxis tickFormatter={v => `${v.toFixed(0)}%`} />
                  <Tooltip formatter={(val) => `${Number(val).toFixed(2)}%`} />
                  <Line 
                    type="monotone" 
                    dataKey="volatility" 
                    name="Volatility (%)" 
                    stroke="#f97316" 
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Calculated from stock price movements only. Excludes cash flow effects (new purchases/sales).
            </p>
          </div>
        </>
      )}
    </div>
  );
}

export default RiskAnalysis;
