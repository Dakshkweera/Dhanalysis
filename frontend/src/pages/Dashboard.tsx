import { useState, useEffect } from 'react';

function Dashboard() {
  const [userName, setUserName] = useState('User');
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUserProfile();
  }, []);

  const fetchUserProfile = async () => {
    try {
      const token = localStorage.getItem('firebaseToken');
      const uid = localStorage.getItem('userId');

      if (!token || !uid) {
        window.location.href = '/login';
        return;
      }

      setUserId(uid);

      const response = await fetch(`http://localhost:5000/api/users/${uid}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (response.ok && result.user) {
        setUserName(result.user.name || 'User');
      }
    } catch (err: any) {
      console.error('Failed to fetch user profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('firebaseToken');
    localStorage.removeItem('userId');
    window.location.href = '/login';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-gray-600 text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-800">Dhanalysis</h1>
          <button
            onClick={handleLogout}
            className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 font-semibold"
          >
            Logout
          </button>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-md p-8 mb-6">
          <h2 className="text-3xl font-bold text-gray-800 mb-2">
            Welcome back, {userName}! 👋
          </h2>
          <p className="text-gray-600 text-lg">
            Here's your investment dashboard
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Portfolio Summary</h3>
            <p className="text-gray-500 italic">Portfolio data coming soon...</p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Recent Activity</h3>
            <p className="text-gray-500 italic">Activity logs coming soon...</p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Investment Goals</h3>
            <p className="text-gray-500 italic">Goals coming soon...</p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Quick Actions</h3>
            <button className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 font-semibold">
              Add Investment
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
