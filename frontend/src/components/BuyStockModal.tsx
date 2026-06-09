import { useState } from 'react';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';
import { fetchWithAuth } from '../utils/fetchWithAuth';

interface BuyStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const today = new Date().toISOString().split('T')[0];

function BuyStockModal({ isOpen, onClose, onSuccess }: BuyStockModalProps) {
  const [formData, setFormData] = useState({
    symbol: '',
    type: 'Stock',
    quantity: '',
    buyDate: '',
    buyPrice: ''
  });
  const [loading, setLoading] = useState(false);
  const [priceMode, setPriceMode] = useState<'auto' | 'manual'>('auto');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.symbol.trim()) {
      toast.error('Please enter stock symbol');
      return;
    }
    if (!formData.quantity || parseFloat(formData.quantity) <= 0) {
      toast.error('Please enter valid quantity');
      return;
    }
    if (!formData.buyDate) {
      toast.error('Please select buy date');
      return;
    }

    // Block weekends instantly
    const selectedDay = new Date(formData.buyDate).getUTCDay();
    if (selectedDay === 0 || selectedDay === 6) {
      toast.error('Markets are closed on weekends. Please select a weekday.');
      return;
    }


    setLoading(true);

    try {
      const userId = localStorage.getItem('userId');

      const response = await fetchWithAuth(`${import.meta.env.VITE_API_BASE_URL}/investments/add-investment`, {
        method: 'POST',
        body: JSON.stringify({
          userId,
          symbol:   formData.symbol.toUpperCase().trim(),
          type:     formData.type,
          quantity: parseFloat(formData.quantity),
          buyDate:  formData.buyDate,
          ...(priceMode === 'manual' && formData.buyPrice
            ? { buyPrice: parseFloat(formData.buyPrice) }
            : {})
        })
      });

      // Check if response is OK (200-299)
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success || data.investment) {
        toast.success('Investment added! Charts updating... ✅');
        setFormData({ symbol: '', type: 'Stock', quantity: '', buyDate: '' });
        onClose();
        // Small delay for backfill to start, then refresh list
        setTimeout(() => onSuccess(), 1500);
      } else if (data.code === 'NOT_TRADING_DAY') {
        toast.error(`📅 ${data.error}`);
      } else if (data.code === 'PRO_FEATURE') {
        toast.error(`🔒 ${data.proMessage || 'This is a Pro feature'}`);
      } else if (data.error) {
        toast.error(data.error);
      } else {
        throw new Error('Unexpected response format');
      }

    } catch (err: any) {
      console.error('Error adding investment:', err);
      if (err.message.includes('Failed to fetch')) {
        toast.error('❌ Cannot connect to server. Is backend running?');
      } else {
        toast.error(`❌ ${err.message || 'Failed to add investment'}`);
      }
      
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md mx-4 p-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
            Buy Stock
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Symbol Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Stock Symbol <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.symbol}
              onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
              placeholder="e.g., TCS.NS, INFY.NS, SILVERIETF.NS"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="mt-1 text-xs text-orange-600 dark:text-orange-400 flex items-start gap-1">
              <span>⚠️</span>
              <span>Enter correct NSE ticker symbol (must include .NS suffix)</span>
            </p>
          </div>

          {/* Type Dropdown */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Type <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="Stock">Stock</option>
              <option value="ETF">ETF</option>
              <option value="Mutual Fund">Mutual Fund</option>
            </select>
          </div>

          {/* Quantity Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Quantity <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={formData.quantity}
              onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
              placeholder="e.g., 10"
              min="0.01"
              step="0.01"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Buy Date Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Buy Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={formData.buyDate}
              onChange={(e) => setFormData({ ...formData, buyDate: e.target.value })}
              max={today}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Price mode toggle */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-blue-700 dark:text-blue-300 font-medium">Buy Price</p>
              <div className="flex gap-1 text-xs">
                <button
                  type="button"
                  onClick={() => setPriceMode('auto')}
                  className={`px-2 py-0.5 rounded ${priceMode === 'auto' ? 'bg-blue-500 text-white' : 'text-blue-600 dark:text-blue-400 hover:underline'}`}
                >
                  Auto-fetch
                </button>
                <span className="text-blue-400">|</span>
                <button
                  type="button"
                  onClick={() => setPriceMode('manual')}
                  className={`px-2 py-0.5 rounded ${priceMode === 'manual' ? 'bg-blue-500 text-white' : 'text-blue-600 dark:text-blue-400 hover:underline'}`}
                >
                  Enter manually
                </button>
              </div>
            </div>

            {priceMode === 'auto' ? (
              <p className="text-xs text-blue-600 dark:text-blue-400">
                💡 Price will be fetched from market data for the selected date.
              </p>
            ) : (
              <input
                type="number"
                value={formData.buyPrice}
                onChange={e => setFormData({ ...formData, buyPrice: e.target.value })}
                placeholder="Enter buy price (₹)"
                min="0.01"
                step="0.01"
                required={priceMode === 'manual'}
                className="w-full mt-1 px-3 py-1.5 border border-blue-300 dark:border-blue-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-sm focus:ring-2 focus:ring-blue-500"
              />
            )}
          </div>

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
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin">⏳</span>
                  Adding...
                </span>
              ) : (
                'Buy Stock'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default BuyStockModal;
