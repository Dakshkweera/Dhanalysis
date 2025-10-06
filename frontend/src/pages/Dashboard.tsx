import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Wallet, BarChart3 } from 'lucide-react';
import toast from 'react-hot-toast';
import MetricCard from '../components/MetricCard';

function Dashboard() {
  const [summary, setSummary] = useState<any>(null);
  const [allocation, setAllocation] = useState<any>(null);
  const [portfolioChange, setPortfolioChange] = useState<any>(null);
  const [niftyToday, setNiftyToday] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

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
        `http://localhost:5000/api/portfolio/summary?userId=${userId}`,
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
        `http://localhost:5000/api/portfolio/allocation?userId=${userId}`,
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

      // 3. Fetch history for today's change
      const historyResponse = await fetch(
        `http://localhost:5000/api/portfolio/history?userId=${userId}&days=7`,
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
          percent: changePercent,
          invested: today.totalInvested,
          currentValue: today.portfolioValue
        });
      } else if (historyData.success && historyData.data && historyData.data.length === 1) {
        const today = historyData.data[0];
        setPortfolioChange({
          value: 0,
          percent: 0,
          invested: today.totalInvested,
          currentValue: today.portfolioValue
        });
      }

      // 4. Fetch NIFTY data
      try {
        const niftyResponse = await fetch('http://localhost:5000/api/market/nifty');
        const niftyData = await niftyResponse.json();
        
        if (niftyData.success && niftyData.nifty) {
          setNiftyToday(niftyData.nifty);
        }
      } catch (error) {
        console.log('NIFTY endpoint not available');
      }

    } catch (err: any) {
      console.error('Error fetching dashboard data:', err);
      toast.error(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-lg text-gray-600 dark:text-gray-300 animate-pulse">Loading dashboard...</div>
      </div>
    );
  }

  // Get best/worst performer details with stock data
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

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
          Dashboard
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-lg">
          Your investment overview
        </p>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Best Performer Card */}
        <MetricCard
          title="Best Performer"
          value={
            bestPerformer?.roi !== null && bestPerformer?.roi !== undefined
              ? `${bestPerformer.roi >= 0 ? '+' : ''}${bestPerformer.roi.toFixed(2)}%`
              : 'N/A'
          }
          subtitle={
            bestPerformer
              ? `${bestPerformer.symbol}\nInvested: ₹${bestPerformer.invested.toLocaleString('en-IN')}\nCurrent: ₹${bestPerformer.currentValue.toLocaleString('en-IN')}\nGain: ₹${Math.abs(bestPerformer.profitLoss).toLocaleString('en-IN')}`
              : 'No investments yet'
          }
          icon={TrendingUp}
          trend="up"
          bgColor="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20"
        />

        {/* Worst Performer Card */}
        <MetricCard
          title="Worst Performer"
          value={
            worstPerformer?.roi !== null && worstPerformer?.roi !== undefined
              ? `${worstPerformer.roi >= 0 ? '+' : ''}${worstPerformer.roi.toFixed(2)}%`
              : 'N/A'
          }
          subtitle={
            worstPerformer
              ? `${worstPerformer.symbol}\nInvested: ₹${worstPerformer.invested.toLocaleString('en-IN')}\nCurrent: ₹${worstPerformer.currentValue.toLocaleString('en-IN')}\nLoss: ₹${Math.abs(worstPerformer.profitLoss).toLocaleString('en-IN')}`
              : 'No investments yet'
          }
          icon={TrendingDown}
          trend="down"
          bgColor="bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20"
        />

        {/* Portfolio Value Card */}
        <MetricCard
          title="Portfolio Value"
          value={
            portfolioChange?.currentValue 
              ? `₹${portfolioChange.currentValue.toLocaleString('en-IN')}`
              : 'N/A'
          }
          subtitle={
            portfolioChange?.invested
              ? `Invested: ₹${portfolioChange.invested.toLocaleString('en-IN')}\nToday: ${portfolioChange.percent >= 0 ? '+' : ''}${portfolioChange.percent.toFixed(2)}%\nChange: ${portfolioChange.value >= 0 ? '+' : ''}₹${Math.abs(portfolioChange.value).toLocaleString('en-IN')}`
              : 'No investments yet'
          }
          icon={Wallet}
          trend={portfolioChange?.value >= 0 ? 'up' : 'down'}
          bgColor="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20"
        />

        {/* NIFTY 50 Card */}
        <MetricCard
          title="NIFTY 50 Today"
          value={
            niftyToday?.changePercent !== null && !isNaN(niftyToday?.changePercent)
              ? `${niftyToday.changePercent >= 0 ? '+' : ''}${niftyToday.changePercent.toFixed(2)}%`
              : 'N/A'
          }
          subtitle={
            niftyToday?.value
              ? `Index Value\n₹${niftyToday.value.toLocaleString('en-IN')}\nMarket Benchmark`
              : 'Market Benchmark'
          }
          icon={BarChart3}
          trend={niftyToday?.changePercent >= 0 ? 'up' : 'down'}
          bgColor="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20"
        />
      </div>

      {/* Chart Placeholder */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 border border-gray-100 dark:border-gray-700">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Portfolio Performance
        </h2>
        <p className="text-gray-500 dark:text-gray-400 italic text-lg">
          Chart coming in next task...
        </p>
      </div>
    </div>
  );
}

export default Dashboard;
