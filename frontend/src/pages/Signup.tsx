import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

type Step = 'form' | 'otp' | 'creating';

function Signup() {
  const { login }               = useAuth();
  const [step, setStep]         = useState<Step>('form');
  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp]           = useState('');
  const [error, setError]       = useState('');
  const [info, setInfo]         = useState('');
  const [loading, setLoading]   = useState(false);

  // ── Step 1: Send OTP ────────────────────────────────────────────────────────
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res  = await fetch(`${import.meta.env.VITE_API_BASE_URL}/auth/send-otp`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email }),
      });
      const data = await res.json();

      if (!data.success) {
        setError(data.message);
        return;
      }

      setInfo(`OTP sent to ${email}. Check your inbox.`);
      setStep('otp');
    } catch {
      setError('Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Resend OTP ──────────────────────────────────────────────────────────────
  const handleResendOtp = async () => {
    setError('');
    setInfo('');
    setLoading(true);

    try {
      const res  = await fetch(`${import.meta.env.VITE_API_BASE_URL}/auth/send-otp`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.success) setInfo('New OTP sent!');
      else setError(data.message);
    } catch {
      setError('Failed to resend OTP.');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: Verify OTP + Create Account ─────────────────────────────────────
  const handleVerifyAndSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // 1. Verify OTP
      const verifyRes  = await fetch(`${import.meta.env.VITE_API_BASE_URL}/auth/verify-otp`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, otp }),
      });
      const verifyData = await verifyRes.json();

      if (!verifyData.success) {
        setError(verifyData.message);
        return;
      }

      // 2. OTP verified — register with our backend
      setStep('creating');
      const registerRes = await fetch(`${import.meta.env.VITE_API_BASE_URL}/auth/register`, {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include', // receive HttpOnly refresh cookie
        body:        JSON.stringify({ name: name || 'User', email, password }),
      });
      const registerData = await registerRes.json();

      if (!registerData.success) {
        throw new Error(registerData.message || 'Registration failed');
      }

      login(registerData.accessToken, registerData.user);
      window.location.href = '/onboarding';

    } catch (err: any) {
      setStep('otp');
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── UI ───────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-md w-96">

        {/* Header */}
        <h1 className="text-2xl font-bold text-gray-800 mb-2 text-center">Create Account</h1>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className={`flex items-center gap-1 text-xs font-semibold ${step === 'form' ? 'text-blue-600' : 'text-green-600'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-xs ${step === 'form' ? 'bg-blue-500' : 'bg-green-500'}`}>
              {step === 'form' ? '1' : '✓'}
            </span>
            Details
          </div>
          <div className="w-8 h-px bg-gray-300" />
          <div className={`flex items-center gap-1 text-xs font-semibold ${step === 'otp' ? 'text-blue-600' : step === 'creating' ? 'text-green-600' : 'text-gray-400'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-xs ${step === 'otp' ? 'bg-blue-500' : step === 'creating' ? 'bg-green-500' : 'bg-gray-300'}`}>
              {step === 'creating' ? '✓' : '2'}
            </span>
            Verify Email
          </div>
          <div className="w-8 h-px bg-gray-300" />
          <div className={`flex items-center gap-1 text-xs font-semibold ${step === 'creating' ? 'text-blue-600' : 'text-gray-400'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-xs ${step === 'creating' ? 'bg-blue-500' : 'bg-gray-300'}`}>
              3
            </span>
            Done
          </div>
        </div>

        {/* ── STEP 1: Details form ── */}
        {step === 'form' && (
          <form onSubmit={handleSendOtp}>
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2">Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                placeholder="John Doe"
                required
              />
            </div>

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
                minLength={6}
                required
              />
              <p className="text-xs text-gray-500 mt-1">Minimum 6 characters</p>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded text-sm">{error}</div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-500 text-white py-2 rounded-lg font-semibold hover:bg-blue-600 disabled:bg-gray-400"
            >
              {loading ? 'Sending OTP...' : 'Send Verification Code →'}
            </button>
          </form>
        )}

        {/* ── STEP 2: OTP input ── */}
        {step === 'otp' && (
          <form onSubmit={handleVerifyAndSignup}>
            <div className="mb-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
              📧 {info || `OTP sent to ${email}`}
            </div>

            <div className="mb-4 mt-4">
              <label className="block text-gray-700 text-sm font-bold mb-2">Enter 6-digit OTP</label>
              <input
                type="text"
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-center text-2xl font-bold tracking-widest"
                placeholder="000000"
                maxLength={6}
                required
              />
              <p className="text-xs text-gray-500 mt-1 text-center">Valid for 10 minutes</p>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded text-sm">{error}</div>
            )}

            <button
              type="submit"
              disabled={loading || otp.length < 6}
              className="w-full bg-blue-500 text-white py-2 rounded-lg font-semibold hover:bg-blue-600 disabled:bg-gray-400"
            >
              {loading ? 'Verifying...' : 'Verify & Create Account'}
            </button>

            <div className="mt-3 flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={() => { setStep('form'); setError(''); setOtp(''); }}
                className="text-gray-500 hover:underline"
              >
                ← Change email
              </button>
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={loading}
                className="text-blue-500 hover:underline disabled:text-gray-400"
              >
                Resend OTP
              </button>
            </div>
          </form>
        )}

        {/* ── STEP 3: Creating ── */}
        {step === 'creating' && (
          <div className="text-center py-6">
            <div className="text-4xl mb-3">🔄</div>
            <p className="text-gray-600 font-medium">Creating your account...</p>
          </div>
        )}

        {/* Login link */}
        {step === 'form' && (
          <div className="mt-4 text-center">
            <p className="text-gray-600 text-sm">
              Already have an account?{' '}
              <a href="/login" className="text-blue-500 font-semibold hover:underline">Login</a>
            </p>
          </div>
        )}

      </div>
    </div>
  );
}

export default Signup;
