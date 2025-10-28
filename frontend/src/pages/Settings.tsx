import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { User, Bell, Shield, Database, Palette, Sparkles, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface UsageStats {
  questionsAsked: number;
  questionLimit: number | string;
  remaining: number | string;
  isPremium: boolean;
}

function Settings() {
  const { currentUser, userId } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('account');
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);

  useEffect(() => {
    if (userId) {
      loadUsageStats();
    }
  }, [userId]);

  const loadUsageStats = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/ai/usage/${userId}`);
      const data = await response.json();
      if (data.success) {
        setUsageStats(data.usage);
      }
    } catch (error) {
      console.error('Failed to load usage stats:', error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('firebaseToken');
    localStorage.removeItem('userId');
    navigate('/login');
  };

  const tabs = [
    { id: 'account', label: 'Account', icon: User },
    { id: 'ai', label: 'AI Settings', icon: Sparkles },
    { id: 'display', label: 'Display', icon: Palette },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'data', label: 'Data & Privacy', icon: Database },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Settings
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage your account and application preferences
          </p>
        </div>

        <div className="flex gap-6">
          {/* Sidebar Tabs */}
          <div className="w-64 bg-white dark:bg-gray-800 rounded-lg p-4 h-fit">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors mb-2 ${
                  activeTab === tab.id
                    ? 'bg-blue-500 text-white'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <tab.icon size={20} />
                <span className="font-medium">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Content Area */}
          <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg p-6">
            {activeTab === 'account' && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
                  Account Settings
                </h2>

                {/* User Info */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={currentUser?.email || ''}
                    disabled
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    User ID
                  </label>
                  <input
                    type="text"
                    value={userId || ''}
                    disabled
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm"
                  />
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Account Created
                  </label>
                  <input
                    type="text"
                    value={currentUser?.metadata?.creationTime ? new Date(currentUser.metadata.creationTime).toLocaleDateString() : 'N/A'}
                    disabled
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 font-semibold"
                >
                  <LogOut size={20} />
                  <span>Logout</span>
                </button>
              </div>
            )}

            {activeTab === 'ai' && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
                  AI Settings
                </h2>

                {/* Usage Stats */}
                {usageStats && (
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-6 mb-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          Monthly Usage
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Questions asked this month
                        </p>
                      </div>
                      <div className="text-right">
                        <div className={`text-3xl font-bold ${
                          usageStats.remaining === 0 
                            ? 'text-red-600'
                            : typeof usageStats.remaining === 'number' && usageStats.remaining <= 3
                            ? 'text-yellow-600'
                            : 'text-green-600'
                        }`}>
                          {usageStats.isPremium ? '∞' : `${usageStats.remaining}/${usageStats.questionLimit}`}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {usageStats.isPremium ? 'Unlimited' : 'Remaining'}
                        </p>
                      </div>
                    </div>

                    {!usageStats.isPremium && (
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all"
                          style={{
                            width: `${((usageStats.questionsAsked as number) / (usageStats.questionLimit as number)) * 100}%`
                          }}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Premium Upgrade */}
                {!usageStats?.isPremium && (
                  <div className="border-2 border-yellow-400 dark:border-yellow-600 rounded-lg p-6 mb-6">
                    <div className="flex items-start gap-4">
                      <div className="text-4xl">⭐</div>
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                          Upgrade to Premium
                        </h3>
                        <ul className="space-y-2 mb-4 text-gray-700 dark:text-gray-300">
                          <li className="flex items-center gap-2">
                            <span className="text-green-500">✓</span>
                            Unlimited AI questions
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="text-green-500">✓</span>
                            Priority support
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="text-green-500">✓</span>
                            Advanced analytics
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="text-green-500">✓</span>
                            Export reports (PDF)
                          </li>
                        </ul>
                        <button className="px-6 py-3 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 font-semibold">
                          Upgrade Now - ₹499/month
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* AI Preferences */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Response Style
                    </label>
                    <select className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                      <option>Detailed (Recommended)</option>
                      <option>Brief</option>
                      <option>Technical</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-gray-700">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        Include Sources
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Show reference links in responses
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      defaultChecked
                      className="w-5 h-5 text-blue-600"
                    />
                  </div>

                  <div className="flex items-center justify-between py-3">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        Save Chat History
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Keep record of conversations
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      defaultChecked
                      className="w-5 h-5 text-blue-600"
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'display' && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
                  Display Settings
                </h2>

                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Theme
                    </label>
                    <select className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                      <option>Light</option>
                      <option>Dark</option>
                      <option>Auto (System)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Date Format
                    </label>
                    <select className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                      <option>DD/MM/YYYY</option>
                      <option>MM/DD/YYYY</option>
                      <option>YYYY-MM-DD</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Number Format
                    </label>
                    <select className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                      <option>Indian (1,00,000)</option>
                      <option>International (100,000)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'notifications' && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
                  Notification Preferences
                </h2>

                <div className="space-y-4">
                  {[
                    { label: 'Daily Portfolio Summary', desc: 'Get daily email with portfolio performance' },
                    { label: 'Weekly Reports', desc: 'Receive weekly analytics report' },
                    { label: 'Price Alerts', desc: 'Notify when stocks hit target prices' },
                    { label: 'AI Insights Digest', desc: 'Weekly summary of AI recommendations' },
                    { label: 'Security Alerts', desc: 'Login and security notifications' },
                  ].map((item, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-gray-700"
                    >
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {item.label}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {item.desc}
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        defaultChecked={index < 2}
                        className="w-5 h-5 text-blue-600"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'security' && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
                  Security Settings
                </h2>

                <div className="space-y-6">
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium text-gray-900 dark:text-white">
                        Two-Factor Authentication
                      </p>
                      <span className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-sm rounded-full">
                        Coming Soon
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Add an extra layer of security to your account
                    </p>
                  </div>

                  <div>
                    <button className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 font-medium">
                      Change Password
                    </button>
                  </div>

                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
                      Active Sessions
                    </h3>
                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            Current Device
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {new Date().toLocaleString()}
                          </p>
                        </div>
                        <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-sm rounded-full">
                          Active
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'data' && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
                  Data & Privacy
                </h2>

                <div className="space-y-4">
                  <button className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 font-medium text-left">
                    <div className="flex items-center justify-between">
                      <span>Download Your Data</span>
                      <span className="text-sm text-gray-500">Export as JSON</span>
                    </div>
                  </button>

                  <button className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 font-medium text-left">
                    <div className="flex items-center justify-between">
                      <span>Clear Chat History</span>
                      <span className="text-sm text-gray-500">Delete all conversations</span>
                    </div>
                  </button>

                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mt-8">
                    <h3 className="font-semibold text-red-900 dark:text-red-400 mb-2">
                      Danger Zone
                    </h3>
                    <p className="text-sm text-red-700 dark:text-red-500 mb-4">
                      Once you delete your account, there is no going back. Please be certain.
                    </p>
                    <button className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium">
                      Delete Account
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Settings;
