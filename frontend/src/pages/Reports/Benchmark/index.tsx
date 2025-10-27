import { useState, useEffect } from 'react';
import { Line } from 'react-chartjs-2';
import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  PointElement, 
  LineElement, 
  Title, 
  Tooltip, 
  Legend,
  Filler 
} from 'chart.js';
import toast from 'react-hot-toast';
import MetricCard from '../../../components/reports/MetricCard';
import TimePeriodSelector from '../../../components/reports/TimePeriodSelector';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface DailyComparison {
  date: string;
  portfolioReturn: number;
  niftyReturn: number;
  outperformance: number;
  beatNifty: boolean;
}

interface BenchmarkData {
  success: boolean;
  correlation: number;
  beta: number;
  portfolioReturn: number;
  niftyReturn: number;
  outperformance: number;
  daysAboveNifty: number;
  daysBelowNifty: number;
  dailyComparison: DailyComparison[];
}

// Period mapping
const PERIOD_DAYS: { [key: string]: number } = {
  '1M': 30,
  '3M': 90,
  '6M': 180,
  '1Y': 365,
  '3Y': 1095,
  '5Y': 1825,
  'All': 10000,
};

// Helper: Calculate correlation
const calculateCorrelation = (x: number[], y: number[]): number => {
  const n = x.length;
  if (n !== y.length || n === 0) return 0;

  const meanX = x.reduce((a, b) => a + b, 0) / n;
  const meanY = y.reduce((a, b) => a + b, 0) / n;

  let numerator = 0;
  let sumSqX = 0;
  let sumSqY = 0;

  for (let i = 0; i < n; i++) {
    const diffX = x[i] - meanX;
    const diffY = y[i] - meanY;
    numerator += diffX * diffY;
    sumSqX += diffX * diffX;
    sumSqY += diffY * diffY;
  }

  const denominator = Math.sqrt(sumSqX * sumSqY);
  return denominator === 0 ? 0 : numerator / denominator;
};

// Helper: Calculate standard deviation
const calculateStdDev = (values: number[]): number => {
  const n = values.length;
  if (n === 0) return 0;
  
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const squaredDiffs = values.map(value => Math.pow(value - mean, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / n;
  
  return Math.sqrt(variance);
};

function Benchmark() {
  const [selectedPeriod, setSelectedPeriod] = useState('1M');
  const [data, setData] = useState<BenchmarkData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actualPeriodDays, setActualPeriodDays] = useState(0);

  useEffect(() => {
    fetchBenchmarkData();
  }, [selectedPeriod]);

  const fetchBenchmarkData = async () => {
    setLoading(true);
    
    try {
      const userId = localStorage.getItem('userId');
      const token = localStorage.getItem('firebaseToken');
      
      if (!userId || !token) {
        toast.error('Please login again');
        return;
      }

      const days = PERIOD_DAYS[selectedPeriod] || 30;

      const response = await fetch(
        `https://dhanalysis.onrender.com/api/portfolio/history?userId=${userId}&days=${days}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || 'Failed to fetch data');
      }

      if (!result.data || result.data.length === 0) {
        throw new Error('No historical data available');
      }

      // Calculate actual days from data
      const firstDate = new Date(result.data[0].date);
      const lastDate = new Date(result.data[result.data.length - 1].date);
      const actualDays = Math.floor((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
      setActualPeriodDays(actualDays);

      const portfolioReturns = result.data.map((d: any) => d.dailyReturn || 0);
      const niftyReturns = result.data.map((d: any) => d.niftyDailyReturn || 0);
      const correlation = calculateCorrelation(portfolioReturns, niftyReturns);
      const portfolioStdDev = calculateStdDev(portfolioReturns);
      const niftyStdDev = calculateStdDev(niftyReturns);
      const beta = niftyStdDev > 0 ? (correlation * portfolioStdDev) / niftyStdDev : 0;

      const transformedData: BenchmarkData = {
        success: true,
        correlation: parseFloat(correlation.toFixed(3)),
        beta: parseFloat(beta.toFixed(2)),
        portfolioReturn: result.summary.totalChangePercent || 0,
        niftyReturn: result.summary.benchmarkReturn || 0,
        outperformance: result.summary.outperformance || 0,
        daysAboveNifty: result.summary.daysAboveNifty || 0,
        daysBelowNifty: result.summary.daysBelowNifty || 0,
        dailyComparison: result.data.map((day: any) => ({
          date: day.date,
          portfolioReturn: day.dailyReturn || 0,
          niftyReturn: day.niftyDailyReturn || 0,
          outperformance: day.outperformance || 0,
          beatNifty: day.beatNifty || false
        }))
      };

      setData(transformedData);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load benchmark data');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-lg text-gray-600 dark:text-gray-300">Loading benchmark data...</div>
      </div>
    );
  }

  if (!data || !data.dailyComparison || data.dailyComparison.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="text-6xl mb-4">📊</div>
        <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
          No Data Available
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Not enough historical data for benchmark comparison
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

  // Helper function to format period display
  const getPeriodLabel = () => {
    if (selectedPeriod === 'All') {
      if (actualPeriodDays < 30) {
        return `Last ${actualPeriodDays} days`;
      } else if (actualPeriodDays < 365) {
        const months = Math.floor(actualPeriodDays / 30);
        return `Last ${months} month${months > 1 ? 's' : ''}`;
      } else {
        const years = Math.floor(actualPeriodDays / 365);
        const remainingMonths = Math.floor((actualPeriodDays % 365) / 30);
        if (remainingMonths > 0) {
          return `Last ${years} year${years > 1 ? 's' : ''} ${remainingMonths} month${remainingMonths > 1 ? 's' : ''}`;
        }
        return `Last ${years} year${years > 1 ? 's' : ''}`;
      }
    }
    return `Last ${selectedPeriod}`;
  };

  // Calculate cumulative indexed returns
  const portfolioIndexed = [100];
  const niftyIndexed = [100];
  
  data.dailyComparison.forEach((day, index) => {
    if (index > 0) {
      portfolioIndexed.push(
        portfolioIndexed[index - 1] * (1 + day.portfolioReturn / 100)
      );
      niftyIndexed.push(
        niftyIndexed[index - 1] * (1 + day.niftyReturn / 100)
      );
    }
  });

  // Chart configuration
  const chartData = {
    labels: data.dailyComparison.map(d => {
      const date = new Date(d.date);
      return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
    }),
    datasets: [
      {
        label: 'Your Portfolio',
        data: portfolioIndexed,
        borderColor: 'rgb(99, 102, 241)',
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        tension: 0.4,
        fill: true,
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 5,
      },
      {
        label: 'NIFTY 50',
        data: niftyIndexed,
        borderColor: 'rgb(245, 158, 11)',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        tension: 0.4,
        fill: true,
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 5,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          usePointStyle: true,
          padding: 15,
          color: '#9ca3af',
          font: { size: 12 },
        },
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        backgroundColor: 'rgba(17, 24, 39, 0.95)',
        titleColor: '#f3f4f6',
        bodyColor: '#f3f4f6',
        borderColor: '#374151',
        borderWidth: 1,
        padding: 12,
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(75, 85, 99, 0.2)' },
        ticks: { color: '#9ca3af' },
      },
      y: {
        grid: { color: 'rgba(75, 85, 99, 0.2)' },
        ticks: { color: '#9ca3af' },
        title: {
          display: true,
          text: 'Indexed Value (Base 100)',
          color: '#9ca3af',
        },
      },
    },
  };

  const totalDays = (data.daysAboveNifty || 0) + (data.daysBelowNifty || 0);
  const winRate = totalDays > 0 ? ((data.daysAboveNifty || 0) / totalDays) * 100 : 0;

  return (
    <div className="space-y-6">
      
      {/* Period Selector - Using TimePeriodSelector component */}
      <div className="flex justify-end">
        <TimePeriodSelector 
          selected={selectedPeriod} 
          onChange={setSelectedPeriod} 
        />
      </div>

      {/* Metric Cards - Top Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <MetricCard
          title="Your Return"
          value={`${data.portfolioReturn >= 0 ? '+' : ''}${data.portfolioReturn.toFixed(2)}%`}
          subtitle={getPeriodLabel()}
          color={data.portfolioReturn >= 0 ? 'profit' : 'loss'}
          trend={data.portfolioReturn >= 0 ? 'up' : 'down'}
          icon="📈"
        />
        <MetricCard
          title="NIFTY 50 Return"
          value={`${data.niftyReturn >= 0 ? '+' : ''}${data.niftyReturn.toFixed(2)}%`}
          subtitle={getPeriodLabel()}
          color={data.niftyReturn >= 0 ? 'profit' : 'loss'}
          trend={data.niftyReturn >= 0 ? 'up' : 'down'}
          icon="📊"
        />
        <MetricCard
          title="Outperformance"
          value={`${data.outperformance >= 0 ? '+' : ''}${data.outperformance.toFixed(2)}%`}
          subtitle={data.outperformance >= 0 ? '🎉 Beating NIFTY!' : '📉 Underperforming'}
          color={data.outperformance >= 0 ? 'profit' : 'loss'}
          trend={data.outperformance >= 0 ? 'up' : 'down'}
          icon="🎯"
        />
      </div>

      {/* Metric Cards - Bottom Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <MetricCard
          title="Win Rate"
          value={`${data.daysAboveNifty}/${totalDays}`}
          subtitle={`${winRate.toFixed(0)}% days beat NIFTY`}
          color="neutral"
          icon="🏆"
        />
        <MetricCard
          title="Correlation"
          value={data.correlation.toFixed(2)}
          subtitle={Math.abs(data.correlation) > 0.7 ? 'Strong correlation' : Math.abs(data.correlation) > 0.4 ? 'Moderate correlation' : 'Weak correlation'}
          color="neutral"
          icon="🔗"
        />
        <MetricCard
          title="Beta vs NIFTY"
          value={data.beta.toFixed(2)}
          subtitle={data.beta < 1 ? 'Less volatile' : data.beta > 1 ? 'More volatile' : 'Same volatility'}
          color="neutral"
          icon="📉"
        />
      </div>

      {/* Performance Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-2">
          Performance Comparison (Indexed to 100)
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Both portfolios start at 100. Higher value = better performance.
        </p>
        <div style={{ height: '400px' }}>
          <Line data={chartData} options={chartOptions} />
        </div>
      </div>

      {/* Daily Comparison Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-6">
          <h3 className="text-lg font-bold text-gray-800 dark:text-white">
            Daily Comparison
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Date
                </th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Your Return
                </th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  NIFTY Return
                </th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Difference
                </th>
                <th className="text-center px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Result
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {data.dailyComparison.slice().reverse().map((day) => (
                <tr 
                  key={day.date}
                  className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {new Date(day.date).toLocaleDateString('en-IN', { 
                      day: '2-digit', 
                      month: 'short', 
                      year: 'numeric' 
                    })}
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-medium ${
                    day.portfolioReturn >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                  }`}>
                    {day.portfolioReturn >= 0 ? '+' : ''}{day.portfolioReturn.toFixed(2)}%
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-medium ${
                    day.niftyReturn >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                  }`}>
                    {day.niftyReturn >= 0 ? '+' : ''}{day.niftyReturn.toFixed(2)}%
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-bold ${
                    day.outperformance >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                  }`}>
                    {day.outperformance >= 0 ? '+' : ''}{day.outperformance.toFixed(2)}%
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    {day.beatNifty ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400">
                        ✅ Win
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400">
                        ❌ Loss
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}

export default Benchmark;
