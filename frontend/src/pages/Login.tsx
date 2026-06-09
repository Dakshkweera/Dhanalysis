import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

function Login() {
  const { login }          = useAuth();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res  = await fetch(`${import.meta.env.VITE_API_BASE_URL}/auth/login`, {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include', // receive HttpOnly refresh token cookie
        body:        JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!data.success) {
        setError(data.message);
        return;
      }

      login(data.accessToken, data.user);
      window.location.href = '/dashboard';
    } catch {
      setError('Failed to connect. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-md w-96">
        <h1 className="text-2xl font-bold text-gray-800 mb-2 text-center">
          Login to Dhanalysis
        </h1>
        <p className="text-center text-gray-500 text-sm mb-6">
          Portfolio analytics for Indian investors
        </p>

        <form onSubmit={handleLogin}>
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
              placeholder="you@example.com"
              required
            />
          </div>

          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-500 text-white py-2 rounded-lg font-semibold hover:bg-blue-600 disabled:bg-gray-400"
          >
            {loading ? 'Logging in…' : 'Login'}
          </button>
        </form>

        <div className="mt-4 text-center">
          <p className="text-gray-600 text-sm">
            Don't have an account?{' '}
            <a href="/signup" className="text-blue-500 font-semibold hover:underline">Sign Up</a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;
