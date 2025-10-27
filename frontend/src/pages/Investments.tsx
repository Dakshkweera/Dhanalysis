import { useState, useEffect } from 'react';
import { TrendingUp, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import TickerStrip from '../components/TickerStrip';
import BuyStockModal from '../components/BuyStockModal';
import InvestmentDetailOverlay from '../components/InvestmentDetailOverlay';
import SellSharesModal from '../components/SellSharesModal';

// Helper function to group investments by symbol
const groupInvestmentsBySymbol = (investments: any[]) => {
  const grouped: { [key: string]: any[] } = {};
  
  investments.forEach(inv => {
    if (!grouped[inv.symbol]) {
      grouped[inv.symbol] = [];
    }
    grouped[inv.symbol].push(inv);
  });
  
  return Object.entries(grouped).map(([symbol, items]) => {
    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
    const totalInvested = items.reduce((sum, item) => sum + parseFloat(item.investedAmount), 0);
    const totalCurrentValue = items.reduce((sum, item) => sum + parseFloat(item.currentValue), 0);
    const totalProfitLoss = totalCurrentValue - totalInvested;
    const avgBuyPrice = totalInvested / totalQuantity;
    const roi = (totalProfitLoss / totalInvested) * 100;
    
    return {
      symbol,
      type: items[0].type,
      quantity: totalQuantity,
      avgBuyPrice: avgBuyPrice,
      currentPrice: items[0].currentPrice,
      investedAmount: totalInvested,
      currentValue: totalCurrentValue,
      profitLoss: totalProfitLoss,
      roi: roi,
      transactions: items,
      oldestDate: items.sort((a, b) => new Date(a.buyDate).getTime() - new Date(b.buyDate).getTime())[0].buyDate
    };
  });
};

function Investments() {
  const [loading, setLoading] = useState(true);
  const [investments, setInvestments] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [investmentAddedInSession, setInvestmentAddedInSession] = useState(false);
  const [selectedInvestment, setSelectedInvestment] = useState<any>(null);
  const [showDetailOverlay, setShowDetailOverlay] = useState(false);
  const [showSellModal, setShowSellModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const userId = localStorage.getItem('userId');
      const token = localStorage.getItem('firebaseToken');

      if (!userId || !token) {
        toast.error('Please login again');
        return;
      }

      const invResponse = await fetch(
        `https://dhanalysis.onrender.com/api/investments/${userId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      const invData = await invResponse.json();
      
      if (invData.investments) {
        setInvestments(invData.investments);
      }

      const summaryResponse = await fetch(
        `https://dhanalysis.onrender.com/api/portfolio/summary?userId=${userId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      const summaryData = await summaryResponse.json();
      
      if (summaryData.success) {
        setSummary(summaryData.summary);
      }

    } catch (err: any) {
      console.error('Error fetching data:', err);
      toast.error('Failed to load investments');
    } finally {
      setLoading(false);
    }
  };

  const handleBuySuccess = () => {
    fetchData();
    setInvestmentAddedInSession(true);
  };

  const handleSellSuccess = () => {
    fetchData();
    setInvestmentAddedInSession(true);
  };

  const handleCardClick = (investment: any) => {
    setSelectedInvestment(investment);
    setShowDetailOverlay(true);
  };

  const handleSellClick = () => {
    setShowDetailOverlay(false);
    setShowSellModal(true);
  };

  const handleProcessHistory = async () => {
    try {
      const confirmed = window.confirm(
        '⚠️ Regenerate Portfolio History?\n\n' +
        'This will recalculate all historical snapshots based on your current investments.\n' +
        'This may take 2-3 minutes.\n\n' +
        'Continue?'
      );

      if (!confirmed) return;

      setLoading(true);
      toast.loading('Processing portfolio history...', { id: 'batch-process' });

      const userId = localStorage.getItem('userId');
      const token = localStorage.getItem('firebaseToken');

      const response = await fetch('https://dhanalysis.onrender.com/api/investments/batch-process', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId })
      });

      if (!response.ok) {
        throw new Error('Failed to process history');
      }

      const data = await response.json();

      if (data.success) {
        toast.success('✅ Portfolio history regenerated successfully!', { id: 'batch-process' });
        setInvestmentAddedInSession(false);
        await fetchData();
      } else {
        throw new Error(data.error || 'Failed to process history');
      }

    } catch (err: any) {
      console.error('Error processing history:', err);
      toast.error(`❌ ${err.message}`, { id: 'batch-process' });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-lg text-gray-600 dark:text-gray-300">Loading investments...</div>
      </div>
    );
  }

  const groupedInvestments = groupInvestmentsBySymbol(investments);
  const totalHoldings = groupedInvestments.length;

  // Filter investments based on search
  const filteredInvestments = groupedInvestments.filter(inv => {
    const query = searchQuery.toLowerCase();
    return (
      inv.symbol.toLowerCase().includes(query) ||
      inv.type.toLowerCase().includes(query)
    );
  });

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">
          Investments
        </h1>
        <p className="text-gray-600 dark:text-gray-300">
          Manage your portfolio holdings
        </p>
      </div>

      {summary && (
        <TickerStrip
          totalInvested={summary.totalInvested || 0}
          currentValue={summary.currentValue || 0}
          totalReturn={summary.roi || 0}
          totalHoldings={totalHoldings}
        />
      )}

      {/* Reminder Banner - Shows when investments added but not processed */}
      {investmentAddedInSession && (
        <div className="mb-6 bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-500 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" size={24} />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-yellow-800 dark:text-yellow-300 mb-1">
              📝 Reminder: Process Portfolio History
            </h3>
            <p className="text-sm text-yellow-700 dark:text-yellow-400 mb-2">
              You've added or modified investments. Make sure to add <strong>all your investments</strong> first, 
              then click "Process History" to generate historical data and charts.
            </p>
            <p className="text-xs text-yellow-600 dark:text-yellow-500">
              💡 <strong>Tip:</strong> Only process once after adding all investments to avoid multiple processing runs.
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <button 
          onClick={() => setShowBuyModal(true)}
          className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
        >
          <span className="text-xl">➕</span>
          Buy Stock
        </button>
        
        <input 
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="🔍 Search by symbol or type..." 
          className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        
        <button 
          onClick={handleProcessHistory}
          disabled={!investmentAddedInSession}
          className={`px-6 py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors ${
            investmentAddedInSession
              ? 'bg-green-500 hover:bg-green-600 text-white cursor-pointer'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
          }`}
        >
          <span className="text-xl">✅</span>
          Process History
        </button>
      </div>

      {groupedInvestments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-24 h-24 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center mb-6">
            <TrendingUp size={48} className="text-blue-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">
            No Investments Yet
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6 text-center max-w-md">
            Start building your portfolio by buying your first stock
          </p>
          <button 
            onClick={() => setShowBuyModal(true)}
            className="px-8 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold transition-colors flex items-center gap-2"
          >
            <span className="text-xl">➕</span>
            Buy Your First Stock
          </button>
        </div>
      ) : filteredInvestments.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-600 dark:text-gray-400 text-lg mb-4">
            No investments match "{searchQuery}"
          </p>
          <button
            onClick={() => setSearchQuery('')}
            className="px-6 py-2 text-blue-500 hover:text-blue-600 font-medium"
          >
            Clear search
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredInvestments.map((inv) => {
            const roi = inv.roi;
            const profitLoss = inv.profitLoss;
            const isProfit = roi >= 0;

            return (
              <div 
                key={inv.symbol}
                onClick={() => handleCardClick(inv)}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-md hover:shadow-xl transition-all cursor-pointer p-6 border border-gray-100 dark:border-gray-700"
              >
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-2xl font-bold text-gray-800 dark:text-white">
                    {inv.symbol.replace('.NS', '')}
                  </h3>
                  <span className="text-xs font-semibold px-2 py-1 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                    {inv.type}
                  </span>
                </div>
                
                <div className="space-y-2">
                  <div className={`text-3xl font-bold ${
                    isProfit ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                  }`}>
                    {roi >= 0 ? '+' : ''}{roi.toFixed(2)}%
                  </div>
                  
                  <div className={`text-lg font-semibold ${
                    isProfit ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                  }`}>
                    {isProfit ? '↗' : '↘'} ₹{Math.abs(profitLoss).toLocaleString()}
                  </div>
                  
                  <div className="text-sm text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-200 dark:border-gray-700">
                    <div>{inv.quantity} shares • Avg: ₹{inv.avgBuyPrice.toFixed(2)}</div>
                    <div className="text-xs mt-1">Current: ₹{parseFloat(inv.currentPrice).toLocaleString()}/share</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <BuyStockModal
        isOpen={showBuyModal}
        onClose={() => setShowBuyModal(false)}
        onSuccess={handleBuySuccess}
      />

      <InvestmentDetailOverlay
        investment={selectedInvestment}
        isOpen={showDetailOverlay}
        onClose={() => setShowDetailOverlay(false)}
        onSellClick={handleSellClick}
      />

      <SellSharesModal
        investment={selectedInvestment}
        isOpen={showSellModal}
        onClose={() => setShowSellModal(false)}
        onSuccess={handleSellSuccess}
      />
    </div>
  );
}

export default Investments;
