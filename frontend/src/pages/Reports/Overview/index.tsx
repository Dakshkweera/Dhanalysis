import { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import toast from 'react-hot-toast';
import MetricCard from '../../../components/reports/MetricCard';

function Overview() {
  const [loading, setLoading] = useState(true);
  const [latestSnapshot, setLatestSnapshot] = useState<any | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const userId = localStorage.getItem('userId');
      const token = localStorage.getItem('firebaseToken');
      if (!userId || !token) {
        toast.error('Please login again');
        return;
      }
      // Always get ALL data, pick the latest one
      const historyRes = await fetch(
        `http://localhost:5000/api/portfolio/history?userId=${userId}&days=10000`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      if (!historyRes.ok) throw new Error(`HTTP ${historyRes.status}: ${historyRes.statusText}`);
      const historyData = await historyRes.json();
      if (historyData.success && historyData.data && historyData.data.length > 0) {
        setLatestSnapshot(historyData.data[historyData.data.length - 1]);
      } else {
        setLatestSnapshot(null);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to load reports data');
      setLatestSnapshot(null);
    } finally {
      setLoading(false);
    }
  };

  // Prepare metrics (till date: always latest)
  const xirr = latestSnapshot?.xirr || 0;
  const cagr = latestSnapshot?.cagr || 0;
  const absoluteReturn = latestSnapshot?.profitLoss || 0;
  const roi = latestSnapshot?.roi || 0;

  // Pie chart allocation (combine duplicate symbols)
  const allocationData: { name: string; value: number; percentage: string }[] = [];
  if (latestSnapshot?.stockPerformance) {
    const stockMap = new Map<string, number>();
    latestSnapshot.stockPerformance.forEach((stock: any) => {
      const symbol = stock.symbol.replace('.NS', '');
      const val = stockMap.get(symbol) || 0;
      stockMap.set(symbol, val + stock.value);
    });
    const total = Array.from(stockMap.values()).reduce((sum, val) => sum + val, 0);
    stockMap.forEach((value, symbol) => {
      allocationData.push({
        name: symbol,
        value: value,
        percentage: ((value / total) * 100).toFixed(1)
      });
    });
    allocationData.sort((a, b) => b.value - a.value);
  }

  // Type distribution (ETF detection)
  const typeData: { name: string; value: number }[] = [];
  if (latestSnapshot?.stockPerformance) {
    latestSnapshot.stockPerformance.forEach((stock: any) => {
      const stockType = stock.symbol.includes('ETF') || stock.symbol.includes('GOLD') || stock.symbol.includes('SILVER')
        ? 'ETF'
        : 'Stock';
      const existing = typeData.find(item => item.name === stockType);
      if (existing) {
        existing.value += stock.value;
      } else {
        typeData.push({ name: stockType, value: stock.value });
      }
    });
  }

  const COLORS = ['#6366f1', '#06b6d4', '#f59e0b', '#ec4899', '#14b8a6', '#8b5cf6', '#84cc16'];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-lg text-gray-600 dark:text-gray-300">Loading overview...</div>
      </div>
    );
  }

  if (!latestSnapshot) {
    return (
      <div className="text-center py-20">
        <div className="text-6xl mb-4">📊</div>
        <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
          No Data Available
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Process portfolio history to see analytics
        </p>
        <button
          onClick={() => window.location.href = '/investments'}
          className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
        >
          Go to Investments
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Metric Cards - "Till date cumulative" */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="XIRR"
          value={`${xirr >= 0 ? '+' : ''}${xirr.toFixed(2)}%`}
          subtitle="Annualized Return (till date)"
          color={xirr >= 0 ? 'profit' : 'loss'}
          trend={xirr >= 0 ? 'up' : 'down'}
          icon="📈"
        />
        <MetricCard
          title="CAGR"
          value={`${cagr >= 0 ? '+' : ''}${cagr.toFixed(2)}%`}
          subtitle="Compound Growth Rate (till date)"
          color={cagr >= 0 ? 'profit' : 'loss'}
          trend={cagr >= 0 ? 'up' : 'down'}
          icon="📊"
        />
        <MetricCard
          title="Absolute Return"
          value={`₹${Math.abs(absoluteReturn).toLocaleString()}`}
          subtitle={absoluteReturn >= 0 ? 'Total Profit' : 'Total Loss'}
          color={absoluteReturn >= 0 ? 'profit' : 'loss'}
          trend={absoluteReturn >= 0 ? 'up' : 'down'}
          icon="💰"
        />
        <MetricCard
          title="ROI"
          value={`${roi >= 0 ? '+' : ''}${roi.toFixed(2)}%`}
          subtitle="Simple Return (till date)"
          color={roi >= 0 ? 'profit' : 'loss'}
          trend={roi >= 0 ? 'up' : 'down'}
          icon="🎯"
        />
      </div>

      {/* Pie Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Portfolio Allocation */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">
            Portfolio Allocation
          </h3>
          {allocationData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={allocationData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percentage }: any) => `${name}: ${percentage}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {allocationData.map((_entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => `₹${value.toLocaleString()}`} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-gray-500">
              No allocation data available
            </div>
          )}
        </div>

        {/* Type Distribution */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">
            Type Distribution
          </h3>
          {typeData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={typeData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }: any) => `${name}: ₹${value.toLocaleString()}`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {typeData.map((_entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => `₹${value.toLocaleString()}`} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-gray-500">
              No type distribution data available
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Overview;