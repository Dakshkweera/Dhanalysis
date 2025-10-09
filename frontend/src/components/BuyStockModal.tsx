import { useState } from 'react';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';

interface BuyStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function BuyStockModal({ isOpen, onClose, onSuccess }: BuyStockModalProps) {
  const [formData, setFormData] = useState({
    symbol: '',
    type: 'Stock',
    quantity: '',
    buyPrice: '',
    buyDate: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.symbol.trim()) {
      toast.error('Please enter stock symbol');
      return;
    }
    
    if (!formData.quantity || parseFloat(formData.quantity) <= 0) {
      toast.error('Please enter valid quantity');
      return;
    }
    
    if (!formData.buyPrice || parseFloat(formData.buyPrice) <= 0) {
      toast.error('Please enter valid buy price');
      return;
    }
    
    if (!formData.buyDate) {
      toast.error('Please select buy date');
      return;
    }

    // Validate buy date is not in future
    const selectedDate = new Date(formData.buyDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (selectedDate > today) {
      toast.error('Buy date cannot be in the future');
      return;
    }

    setLoading(true);

    try {
      const userId = localStorage.getItem('userId');
      const token = localStorage.getItem('firebaseToken');

      const response = await fetch('http://localhost:5000/api/investments/add-investment', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId,
          symbol: formData.symbol.toUpperCase().trim(),
          type: formData.type,
          quantity: parseFloat(formData.quantity),
          buyPrice: parseFloat(formData.buyPrice),
          buyDate: formData.buyDate
        })
      });

      // Check if response is OK (200-299)
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Check backend success flag
      if (data.success || data.investment) {
        toast.success('Investment added successfully! ✅');
        
        // Reset form
        setFormData({
          symbol: '',
          type: 'Stock',
          quantity: '',
          buyPrice: '',
          buyDate: ''
        });
        
        // Call success callback and close modal
        onSuccess();
        onClose();
      } else if (data.error) {
        // Backend returned error message
        if (data.error.includes('Invalid') || data.error.includes('incomplete')) {
          toast.error('❌ Invalid stock symbol. Please check and try again.');
        } else if (data.error.includes('date')) {
          toast.error('❌ Invalid buy date. Please select a valid past date.');
        } else {
          toast.error(data.error);
        }
      } else {
        throw new Error('Unexpected response format');
      }

    } catch (err: any) {
      console.error('Error adding investment:', err);
      
      // User-friendly error messages
      if (err.message.includes('Failed to fetch')) {
        toast.error('❌ Cannot connect to server. Is backend running?');
      } else if (err.message.includes('Invalid') || err.message.includes('incomplete')) {
        toast.error('❌ Invalid stock symbol. Please enter correct ticker (e.g., TCS.NS)');
      } else if (err.message.includes('401') || err.message.includes('403')) {
        toast.error('❌ Session expired. Please login again.');
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

          {/* Buy Price Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Buy Price (₹) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={formData.buyPrice}
              onChange={(e) => setFormData({ ...formData, buyPrice: e.target.value })}
              placeholder="e.g., 3500"
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
              max={new Date().toISOString().split('T')[0]}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Total Investment Preview */}
          {formData.quantity && formData.buyPrice && (
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Total Investment
              </p>
              <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
                ₹{(parseFloat(formData.quantity) * parseFloat(formData.buyPrice)).toLocaleString()}
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
