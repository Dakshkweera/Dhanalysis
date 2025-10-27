import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Wallet, BarChart3, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';

function Dashboard() {
  const [summary, setSummary] = useState<any>(null);
  const [allocation, setAllocation] = useState<any>(null);
  const [portfolioChange, setPortfolioChange] = useState<any>(null);
  const [niftyToday, setNiftyToday] = useState<any>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [selectedRange, setSelectedRange] = useState('180');
  const [performanceData, setPerformanceData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showCustomRange, setShowCustomRange] = useState(false);
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    if (summary) {
      fetchChartData(selectedRange);
    }
  }, [selectedRange]);

  const fetchDashboardData = async () => {
    try {
      const userId = localStorage.getItem('userId');
      const token = localStorage.getItem('firebaseToken');

      if (!userId || !token) {
        toast.error('Please login again');
        window.location.href = '/login';
        return;
      }

      // 1. Fetch portfolio summary
      const summaryResponse = await fetch(
        `https://dhanalysis.onrender.com/api/portfolio/summary?userId=${userId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const summaryData = await summaryResponse.json();
      
      if (summaryData.success) {
        setSummary(summaryData);
      }

      // 2. Fetch portfolio allocation
      const allocationResponse = await fetch(
        `https://dhanalysis.onrender.com/api/portfolio/allocation?userId=${userId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const allocationData = await allocationResponse.json();
      
      if (allocationData.success) {
        setAllocation(allocationData);
      }

      // 3. Fetch last 7 days history for today's change
      const historyResponse = await fetch(
        `https://dhanalysis.onrender.com/api/portfolio/history?userId=${userId}&days=7`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      const historyData = await historyResponse.json();
      
      if (historyData.success && historyData.data && historyData.data.length >= 2) {
        const snapshots = historyData.data;
        const today = snapshots[snapshots.length - 1];
        const yesterday = snapshots[snapshots.length - 2];
        
        const changeValue = today.portfolioValue - yesterday.portfolioValue;
        const changePercent = ((today.portfolioValue - yesterday.portfolioValue) / yesterday.portfolioValue) * 100;
        
        setPortfolioChange({
          value: changeValue,
          percent: changePercent
        });
      }

      // 4. Fetch NIFTY today data
      try {
        const niftyResponse = await fetch('https://dhanalysis.onrender.com/api/market/nifty');
        const niftyData = await niftyResponse.json();
        
        if (niftyData.success && niftyData.nifty) {
          setNiftyToday(niftyData.nifty);
        }
      } catch (err) {
        console.log('NIFTY data unavailable');
      }

      // 5. Fetch initial chart data (6 months)
      await fetchChartData('180');

    } catch (err: any) {
      console.error('Error fetching dashboard data:', err);
      toast.error(err.message || 'Failed to load dashboard data');
    } finally {
      if (loading) {
        return <div>Loading...</div>;
      }
      setLoading(false);
    }
  };

  

  const fetchChartData = async (rangeValue: string, startDate?: string, endDate?: string) => {
  try {
    const userId = localStorage.getItem('userId');
    const token = localStorage.getItem('firebaseToken');

    let historyUrl = `https://dhanalysis.onrender.com/api/portfolio/history?userId=${userId}`;
    let niftyUrl = `https://dhanalysis.onrender.com/api/market/nifty`;
    
    let daysToFetch = rangeValue;

    // If custom range, calculate days between dates
    if (rangeValue === 'custom' && startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      daysToFetch = diffDays.toString();
      console.log(`Custom range: ${diffDays} days from ${startDate} to ${endDate}`);
    }

    // Use days parameter for both APIs
    historyUrl += `&days=${daysToFetch}`;
    niftyUrl += `?days=${daysToFetch}`;

    console.log('Fetching portfolio history:', historyUrl);
    console.log('Fetching NIFTY data:', niftyUrl);

    // Fetch portfolio history
    const response = await fetch(historyUrl, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();
    
    console.log('Portfolio history response:', data);
    
    if (data.success && data.data && data.data.length > 0) {
      // Format data for chart
      const formattedData = data.data.map((item: any) => ({
        date: new Date(item.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
        fullDate: new Date(item.date).toLocaleDateString('en-IN'),
        portfolioValue: item.portfolioValue,
        investedAmount: item.totalInvested,
        roi: item.roi
      }));
      
      setChartData(formattedData);

      // Calculate Your Return (first to last)
      const firstSnapshot = data.data[0];
      const lastSnapshot = data.data[data.data.length - 1];
      
      const portfolioReturn = ((lastSnapshot.portfolioValue - firstSnapshot.portfolioValue) / firstSnapshot.portfolioValue) * 100;

      console.log('Portfolio Return:', portfolioReturn.toFixed(2) + '%');

      // Fetch NIFTY return for same period
      try {
        const niftyResponse = await fetch(niftyUrl);
        const niftyData = await niftyResponse.json();
        
        console.log('NIFTY response:', niftyData);
        
        let niftyReturn = null;
        
        // Use summary if available
        if (niftyData.success && niftyData.summary && niftyData.summary.totalChangePercent !== undefined) {
          niftyReturn = niftyData.summary.totalChangePercent;
          console.log('NIFTY Return:', niftyReturn.toFixed(2) + '%');
        } else {
          console.warn('NIFTY summary not available');
        }

        setPerformanceData({
          portfolioReturn: portfolioReturn,
          niftyReturn: niftyReturn
        });

      } catch (niftyErr) {
        console.error('NIFTY fetch error:', niftyErr);
        setPerformanceData({
          portfolioReturn: portfolioReturn,
          niftyReturn: null
        });
      }
    } else {
      console.error('No portfolio data returned or API error');
      if (!data.success && data.error) {
        toast.error(data.error);
      } else {
        toast.error('No data available for selected range');
      }
    }
  } catch (err: any) {
    console.error('Error fetching chart data:', err);
    toast.error('Failed to load chart data');
  }
};

const handleCustomRangeApply = () => {
  if (!customStartDate || !customEndDate) {
    toast.error('Please select both start and end dates');
    return;
  }

  const start = new Date(customStartDate);
  const end = new Date(customEndDate);

  if (start > end) {
    toast.error('Start date must be before end date');
    return;
  }

  // Check if date range is too far in the past (before first investment)
  const firstInvestmentDate = summary?.summary?.firstInvestmentDate;
  if (firstInvestmentDate && start < new Date(firstInvestmentDate)) {
    toast.error(`Start date cannot be before your first investment (${new Date(firstInvestmentDate).toLocaleDateString('en-IN')})`);
    return;
  }

  console.log('Applying custom range:', customStartDate, 'to', customEndDate);
  
  setSelectedRange('custom');
  fetchChartData('custom', customStartDate, customEndDate);
  
  const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  toast.success(`Showing ${diffDays} days from ${new Date(customStartDate).toLocaleDateString('en-IN')} to ${new Date(customEndDate).toLocaleDateString('en-IN')}`);
};


  // Get stock details
  const getBestPerformerDetails = () => {
    const bestSymbol = summary?.topPerformers?.best?.symbol;
    if (!bestSymbol || !allocation?.byStock) return null;
    
    const stockDetail = allocation.byStock.find((s: any) => s.symbol === bestSymbol);
    if (!stockDetail) return null;
    
    return {
      symbol: bestSymbol.replace('.NS', ''),
      roi: summary.topPerformers.best.roi,
      profitLoss: summary.topPerformers.best.profitLoss,
      invested: stockDetail.totalInvested,
      currentValue: stockDetail.currentValue
    };
  };

  const getWorstPerformerDetails = () => {
    const worstSymbol = summary?.topPerformers?.worst?.symbol;
    if (!worstSymbol || !allocation?.byStock) return null;
    
    const stockDetail = allocation.byStock.find((s: any) => s.symbol === worstSymbol);
    if (!stockDetail) return null;
    
    return {
      symbol: worstSymbol.replace('.NS', ''),
      roi: summary.topPerformers.worst.roi,
      profitLoss: summary.topPerformers.worst.profitLoss,
      invested: stockDetail.totalInvested,
      currentValue: stockDetail.currentValue
    };
  };

  const bestPerformer = getBestPerformerDetails();
  const worstPerformer = getWorstPerformerDetails();
  
  // Overall portfolio values
  const totalInvested = summary?.summary?.totalInvested || 0;
  const currentValue = summary?.summary?.currentValue || 0;
  const overallProfitLoss = currentValue - totalInvested;
  const overallROI = totalInvested > 0 ? (overallProfitLoss / totalInvested) * 100 : 0;

  // Time range options
  const timeRanges = [
    { label: '7d', value: '7' },
    { label: '1mo', value: '30' },
    { label: '3mo', value: '90' },
    { label: '6mo', value: '180' },
    { label: '1yr', value: '365' },
    { label: '3yr', value: '1095' },
    { label: '5yr', value: '1825' },
    { label: 'All', value: 'all' }
  ];

  // Custom tooltip for chart
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">{data.fullDate}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">Invested: ₹{data.investedAmount.toLocaleString()}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">Value: ₹{data.portfolioValue.toLocaleString()}</p>
          <p className={`text-sm font-semibold ${data.roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            Return: {data.roi >= 0 ? '+' : ''}{data.roi.toFixed(2)}%
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">
          Dashboard
        </h1>
        <p className="text-gray-600 dark:text-gray-300">
          Your investment overview
        </p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        
        {/* Best Performer Card */}
        <div className="bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl shadow-lg p-6 border border-green-200 dark:border-green-800">
          <div className="flex items-start justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Best Performer</h3>
            <div className="p-2 bg-green-500/20 rounded-lg">
              <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
          </div>
          {bestPerformer ? (
            <>
              <div className="text-3xl font-bold text-green-600 dark:text-green-400 mb-2">
                +{bestPerformer.roi.toFixed(2)}%
              </div>
              <div className="space-y-1 text-sm">
                <div className="font-semibold text-gray-800 dark:text-gray-200">{bestPerformer.symbol}</div>
                <div className="text-gray-600 dark:text-gray-400">Invested: ₹{bestPerformer.invested.toLocaleString()}</div>
                <div className="text-gray-600 dark:text-gray-400">Current: ₹{bestPerformer.currentValue.toLocaleString()}</div>
                <div className="text-green-600 dark:text-green-400 font-semibold">Profit: ₹{bestPerformer.profitLoss.toLocaleString()}</div>
              </div>
            </>
          ) : (
            <div className="text-gray-500">No data</div>
          )}
        </div>

        {/* Worst Performer Card */}
        <div className="bg-gradient-to-br from-red-50 to-rose-100 dark:from-red-900/20 dark:to-rose-900/20 rounded-xl shadow-lg p-6 border border-red-200 dark:border-red-800">
          <div className="flex items-start justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Worst Performer</h3>
            <div className="p-2 bg-red-500/20 rounded-lg">
              <TrendingDown className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
          </div>
          {worstPerformer ? (
            <>
              <div className={`text-3xl font-bold mb-2 ${worstPerformer.roi >= 0 ? 'text-green-600' : 'text-red-600 dark:text-red-400'}`}>
                {worstPerformer.roi >= 0 ? '+' : ''}{worstPerformer.roi.toFixed(2)}%
              </div>
              <div className="space-y-1 text-sm">
                <div className="font-semibold text-gray-800 dark:text-gray-200">{worstPerformer.symbol}</div>
                <div className="text-gray-600 dark:text-gray-400">Invested: ₹{worstPerformer.invested.toLocaleString()}</div>
                <div className="text-gray-600 dark:text-gray-400">Current: ₹{worstPerformer.currentValue.toLocaleString()}</div>
                <div className={`font-semibold ${worstPerformer.profitLoss >= 0 ? 'text-green-600' : 'text-red-600 dark:text-red-400'}`}>
                  {worstPerformer.profitLoss >= 0 ? 'Profit' : 'Loss'}: ₹{Math.abs(worstPerformer.profitLoss).toLocaleString()}
                </div>
              </div>
            </>
          ) : (
            <div className="text-gray-500">No data</div>
          )}
        </div>

        {/* Overall Portfolio Card */}
        <div className={`bg-gradient-to-br ${overallProfitLoss >= 0 ? 'from-blue-50 to-cyan-100 dark:from-blue-900/20 dark:to-cyan-900/20 border-blue-200 dark:border-blue-800' : 'from-orange-50 to-red-100 dark:from-orange-900/20 dark:to-red-900/20 border-orange-200 dark:border-orange-800'} rounded-xl shadow-lg p-6 border`}>
          <div className="flex items-start justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Portfolio Overview</h3>
            <div className={`p-2 ${overallProfitLoss >= 0 ? 'bg-blue-500/20' : 'bg-orange-500/20'} rounded-lg`}>
              <Wallet className={`w-5 h-5 ${overallProfitLoss >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400'}`} />
            </div>
          </div>
          <div className={`text-3xl font-bold mb-2 ${overallProfitLoss >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`}>
            ₹{currentValue.toLocaleString()}
          </div>
          <div className="space-y-1 text-sm">
            <div className="text-gray-600 dark:text-gray-400">Invested: ₹{totalInvested.toLocaleString()}</div>
            <div className={`font-semibold ${overallProfitLoss >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {overallProfitLoss >= 0 ? 'Profit' : 'Loss'}: ₹{Math.abs(overallProfitLoss).toLocaleString()} ({overallROI >= 0 ? '+' : ''}{overallROI.toFixed(2)}%)
            </div>
            {portfolioChange && (
              <div className={`text-xs ${portfolioChange.percent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                Today: {portfolioChange.percent >= 0 ? '+' : ''}{portfolioChange.percent.toFixed(2)}%
              </div>
            )}
          </div>
        </div>

        {/* NIFTY 50 Card */}
        <div className="bg-gradient-to-br from-purple-50 to-indigo-100 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-xl shadow-lg p-6 border border-purple-200 dark:border-purple-800">
          <div className="flex items-start justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">NIFTY 50 Today</h3>
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <BarChart3 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
          {niftyToday ? (
            <>
              <div className={`text-3xl font-bold mb-2 ${niftyToday.changePercent >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {niftyToday.changePercent >= 0 ? '+' : ''}{niftyToday.changePercent.toFixed(2)}%
              </div>
              <div className="space-y-1 text-sm">
                <div className="text-gray-800 dark:text-gray-200 font-semibold">₹{niftyToday.value.toLocaleString()}</div>
                <div className="text-gray-600 dark:text-gray-400">Market Benchmark</div>
              </div>
            </>
          ) : (
            <div className="text-gray-500">N/A</div>
          )}
        </div>
      </div>

      {/* Portfolio Performance Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6">
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
              Portfolio Performance
            </h2>
            
            {/* Custom Date Range Toggle */}
            <button
              onClick={() => setShowCustomRange(!showCustomRange)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              <Calendar size={18} />
              <span>Custom Range</span>
            </button>
          </div>

          {/* Custom Date Range Picker */}
          {showCustomRange && (
            <div className="flex items-end gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Start Date
                </label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  End Date
                </label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                onClick={handleCustomRangeApply}
                className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
              >
                Apply
              </button>
            </div>
          )}
          
          {/* Time Range Selector */}
          <div className="flex gap-2 flex-wrap">
            {timeRanges.map((range) => (
              <button
                key={range.value}
                onClick={() => {
                  setSelectedRange(range.value);
                  setShowCustomRange(false);
                }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  selectedRange === range.value
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>

        {/* Chart */}
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis 
                dataKey="date" 
                stroke="#9ca3af"
                style={{ fontSize: '12px' }}
              />
              <YAxis 
                stroke="#9ca3af"
                style={{ fontSize: '12px' }}
                tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area 
                type="monotone" 
                dataKey="portfolioValue" 
                stroke="#10b981" 
                strokeWidth={3}
                fill="url(#colorValue)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-64">
            <p className="text-gray-500 dark:text-gray-400">No chart data available</p>
          </div>
        )}

        {/* Performance Comparison */}
        {performanceData && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Your Return</div>
              <div className={`text-2xl font-bold ${performanceData.portfolioReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {performanceData.portfolioReturn >= 0 ? '+' : ''}{performanceData.portfolioReturn.toFixed(2)}%
              </div>
            </div>
            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">NIFTY Return</div>
              <div className={`text-2xl font-bold ${performanceData.niftyReturn !== null ? (performanceData.niftyReturn >= 0 ? 'text-green-600' : 'text-red-600') : 'text-gray-500'}`}>
                {performanceData.niftyReturn !== null 
                  ? `${performanceData.niftyReturn >= 0 ? '+' : ''}${performanceData.niftyReturn.toFixed(2)}%`
                  : 'N/A'
                }
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
