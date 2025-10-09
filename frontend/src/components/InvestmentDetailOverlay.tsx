import { X } from 'lucide-react';

interface InvestmentDetailOverlayProps {
  investment: any;
  isOpen: boolean;
  onClose: () => void;
  onSellClick: () => void;
}

function InvestmentDetailOverlay({ 
  investment, 
  isOpen, 
  onClose,
  onSellClick 
}: InvestmentDetailOverlayProps) {
  
  if (!isOpen || !investment) return null;

  const isProfit = investment.roi >= 0;

  // Sort transactions by date (oldest first for FIFO display)
  const sortedTransactions = [...investment.transactions].sort(
    (a, b) => new Date(a.buyDate).getTime() - new Date(b.buyDate).getTime()
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6 flex items-start justify-between">
          <div>
            <h2 className="text-3xl font-bold text-gray-800 dark:text-white mb-1">
              {investment.symbol.replace('.NS', '')}
            </h2>
            <span className="inline-block text-xs font-semibold px-2 py-1 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
              {investment.type}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X size={24} className="text-gray-500" />
          </button>
        </div>

        {/* Summary Section */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-3">
            Portfolio Summary
          </h3>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total Holdings</p>
              <p className="text-lg font-bold text-gray-800 dark:text-white">
                {investment.quantity} shares
              </p>
            </div>
            
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Avg Buy Price</p>
              <p className="text-lg font-bold text-gray-800 dark:text-white">
                ₹{investment.avgBuyPrice.toFixed(2)}
              </p>
            </div>
            
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Current Price</p>
              <p className="text-lg font-bold text-gray-800 dark:text-white">
                ₹{parseFloat(investment.currentPrice).toLocaleString()}
              </p>
            </div>
            
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">ROI</p>
              <p className={`text-lg font-bold ${
                isProfit ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
              }`}>
                {isProfit ? '+' : ''}{investment.roi.toFixed(2)}%
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total Invested</p>
              <p className="text-xl font-bold text-gray-800 dark:text-white">
                ₹{investment.investedAmount.toLocaleString()}
              </p>
            </div>
            
            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Current Value</p>
              <p className="text-xl font-bold text-gray-800 dark:text-white">
                ₹{investment.currentValue.toLocaleString()}
              </p>
            </div>
          </div>

          <div className={`mt-4 rounded-lg p-4 ${
            isProfit 
              ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' 
              : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
          }`}>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
              {isProfit ? 'Total Profit' : 'Total Loss'}
            </p>
            <p className={`text-2xl font-bold ${
              isProfit ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
            }`}>
              {isProfit ? '↗' : '↘'} ₹{Math.abs(investment.profitLoss).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Transaction History */}
        <div className="p-6">
          <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-4 flex items-center gap-2">
            <span>📋</span>
            Transaction History (FIFO Order)
          </h3>

          <div className="space-y-3">
            {sortedTransactions.map((txn, index) => {
              const txnProfit = parseFloat(txn.profitLoss);
              const txnROI = parseFloat(txn.roi);
              const isPositive = txnROI >= 0;

              return (
                <div 
                  key={txn._id}
                  className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-800 dark:text-white">
                        Transaction #{index + 1}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(txn.buyDate).toLocaleDateString('en-IN', { 
                          day: 'numeric',
                          month: 'short', 
                          year: 'numeric' 
                        })}
                      </p>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-1 rounded ${
                      isPositive
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    }`}>
                      {isPositive ? '+' : ''}{txnROI.toFixed(2)}%
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">Quantity</p>
                      <p className="font-semibold text-gray-800 dark:text-white">
                        {txn.quantity} shares
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">Buy Price</p>
                      <p className="font-semibold text-gray-800 dark:text-white">
                        ₹{parseFloat(txn.buyPrice).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">Invested</p>
                      <p className="font-semibold text-gray-800 dark:text-white">
                        ₹{parseFloat(txn.investedAmount).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">Current Value</p>
                      <p className="font-semibold text-gray-800 dark:text-white">
                        ₹{parseFloat(txn.currentValue).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className={`mt-2 pt-2 border-t ${
                    isPositive 
                      ? 'border-green-200 dark:border-green-800' 
                      : 'border-red-200 dark:border-red-800'
                  }`}>
                    <p className={`text-sm font-semibold ${
                      isPositive 
                        ? 'text-green-600 dark:text-green-400' 
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      {isPositive ? 'Profit' : 'Loss'}: ₹{Math.abs(txnProfit).toLocaleString()}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Button */}
        <div className="sticky bottom-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-6">
          <button
            onClick={onSellClick}
            className="w-full px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
          >
            <span className="text-xl">📤</span>
            Sell Shares
          </button>
        </div>
      </div>
    </div>
  );
}

export default InvestmentDetailOverlay;
