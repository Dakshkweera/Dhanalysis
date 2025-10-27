import { useState, useEffect } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

interface SellSharesModalProps {
  investment: any;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function SellSharesModal({ investment, isOpen, onClose, onSuccess }: SellSharesModalProps) {
  const [quantityToSell, setQuantityToSell] = useState('');
  const [loading, setLoading] = useState(false);
  const [fifoPreview, setFifoPreview] = useState<any[]>([]);

  useEffect(() => {
    if (quantityToSell && investment) {
      calculateFifoPreview();
    } else {
      setFifoPreview([]);
    }
  }, [quantityToSell, investment]);

  const calculateFifoPreview = () => {
    const sellQty = parseFloat(quantityToSell);
    if (!sellQty || sellQty <= 0) {
      setFifoPreview([]);
      return;
    }

    // Sort transactions by date (oldest first - FIFO)
    const sortedTxns = [...investment.transactions].sort(
      (a, b) => new Date(a.buyDate).getTime() - new Date(b.buyDate).getTime()
    );

    let remainingToSell = sellQty;
    const preview: any[] = [];

    for (const txn of sortedTxns) {
      if (remainingToSell <= 0) break;

      const sellFromThis = Math.min(remainingToSell, txn.quantity);
      preview.push({
        ...txn,
        sellQuantity: sellFromThis,
        remainingQuantity: txn.quantity - sellFromThis,
        willBeDeleted: sellFromThis === txn.quantity
      });

      remainingToSell -= sellFromThis;
    }

    setFifoPreview(preview);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const sellQty = parseFloat(quantityToSell);

    if (!sellQty || sellQty <= 0) {
      toast.error('Please enter valid quantity');
      return;
    }

    if (sellQty > investment.quantity) {
      toast.error(`Cannot sell more than ${investment.quantity} shares`);
      return;
    }

    setLoading(true);

    try {
      const token = localStorage.getItem('firebaseToken');

      // Process each affected transaction in FIFO order
      for (const txn of fifoPreview) {
        if (txn.willBeDeleted) {
          // DELETE entire investment
          const deleteResponse = await fetch(
            `http://localhost:5000/api/investments/delete/${txn._id}`,
            {
              method: 'DELETE',
              headers: {
                'Authorization': `Bearer ${token}`
              }
            }
          );

          if (!deleteResponse.ok) {
            throw new Error(`Failed to delete investment ${txn._id}`);
          }

          console.log(`Deleted investment: ${txn._id}`);

        } else {
          // EDIT (reduce quantity)
          const editResponse = await fetch(
            `http://localhost:5000/api/investments/edit/${txn._id}`,
            {
              method: 'PUT',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                quantity: txn.remainingQuantity,
                buyPrice: txn.buyPrice,
                buyDate: txn.buyDate,
                type: txn.type,
                symbol: txn.symbol
              })
            }
          );

          if (!editResponse.ok) {
            throw new Error(`Failed to edit investment ${txn._id}`);
          }

          console.log(`Updated investment: ${txn._id} - new quantity: ${txn.remainingQuantity}`);
        }
      }

      toast.success(`✅ Successfully sold ${sellQty} shares of ${investment.symbol.replace('.NS', '')}`);
      setQuantityToSell('');
      onSuccess();
      onClose();

    } catch (err: any) {
      console.error('Error selling shares:', err);
      toast.error(`❌ ${err.message || 'Failed to sell shares'}`);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !investment) return null;

  const estimatedProceeds = fifoPreview.reduce((sum, txn) => {
    return sum + (txn.sellQuantity * parseFloat(investment.currentPrice));
  }, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6 flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-1">
              📤 Sell Shares
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {investment.symbol.replace('.NS', '')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Available Shares */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-gray-600 dark:text-gray-400">Available Shares</p>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {investment.quantity} shares
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Current Price: ₹{parseFloat(investment.currentPrice).toLocaleString()}/share
            </p>
          </div>

          {/* Quantity Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              How many shares to sell? <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={quantityToSell}
              onChange={(e) => setQuantityToSell(e.target.value)}
              placeholder="Enter quantity"
              min="0.01"
              max={investment.quantity}
              step="0.01"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>

          {/* FIFO Preview */}
          {fifoPreview.length > 0 && (
            <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4 border border-orange-200 dark:border-orange-800">
              <div className="flex items-start gap-2 mb-3">
                <AlertTriangle size={18} className="text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-orange-800 dark:text-orange-300">
                    FIFO: Will sell from oldest first
                  </p>
                  <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                    {fifoPreview.length} transaction{fifoPreview.length > 1 ? 's' : ''} will be affected
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                {fifoPreview.map((txn) => (
                  <div 
                    key={txn._id}
                    className="bg-white dark:bg-gray-800 rounded p-3 text-xs border border-orange-200 dark:border-orange-800"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-gray-800 dark:text-white">
                        {new Date(txn.buyDate).toLocaleDateString('en-IN', { 
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric' 
                        })}
                      </span>
                      {txn.willBeDeleted ? (
                        <span className="text-red-600 dark:text-red-400 font-semibold">
                          ❌ DELETE
                        </span>
                      ) : (
                        <span className="text-orange-600 dark:text-orange-400 font-semibold">
                          ✏️ UPDATE
                        </span>
                      )}
                    </div>
                    <div className="text-gray-600 dark:text-gray-400">
                      Sell {txn.sellQuantity} shares @ ₹{parseFloat(txn.buyPrice).toFixed(2)}
                      {!txn.willBeDeleted && (
                        <> ({txn.remainingQuantity} will remain)</>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Estimated Proceeds */}
          {quantityToSell && parseFloat(quantityToSell) > 0 && (
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                Estimated Proceeds
              </p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                ₹{estimatedProceeds.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                At current price of ₹{parseFloat(investment.currentPrice).toLocaleString()}/share
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !quantityToSell || parseFloat(quantityToSell) <= 0}
              className="flex-1 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin">⏳</span>
                  Selling...
                </span>
              ) : (
                'Confirm Sell'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default SellSharesModal;
