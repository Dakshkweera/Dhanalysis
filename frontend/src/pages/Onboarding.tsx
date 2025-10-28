import { useState } from 'react';

function Onboarding() {
  const [name, setName] = useState('');
  const [profession, setProfession] = useState('');
  const [investmentGoals, setInvestmentGoals] = useState('');
  const [riskAppetite, setRiskAppetite] = useState('Medium');
  const [age, setAge] = useState('');
  const [annualIncome, setAnnualIncome] = useState('');
  const [investmentExperience, setInvestmentExperience] = useState('Beginner');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const token = localStorage.getItem('firebaseToken');
      const userId = localStorage.getItem('userId');

      if (!token || !userId) {
        throw new Error('Please login first');
      }

      const response = await fetch('${import.meta.env.VITE_API_BASE_URL}/users/update-profile', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          uid: userId,
          name: name,
          profession: profession,
          investmentGoals: investmentGoals,
          riskAppetite: riskAppetite,
          age: age ? parseInt(age) : null,
          annualIncome: annualIncome ? parseFloat(annualIncome) : null,
          investmentExperience: investmentExperience,
        }),
      });

      const result = await response.json();

      if (!response.ok || result.error) {
        throw new Error(result.error || 'Failed to update profile');
      }

      console.log('Profile updated:', result);
      window.location.href = '/dashboard';

    } catch (err: any) {
      setError(err.message);
      console.error('Onboarding error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center py-8">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold text-gray-800 mb-2 text-center">
          Complete Your Profile
        </h1>
        <p className="text-gray-600 text-sm text-center mb-6">
          Tell us more about yourself
        </p>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Full Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
              placeholder="John Doe"
              required
            />
          </div>

          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Profession
            </label>
            <select
              value={profession}
              onChange={(e) => setProfession(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
              required
            >
              <option value="">Select your profession</option>
              <option value="Student">Student</option>
              <option value="Working Professional">Working Professional</option>
              <option value="Business Owner">Business Owner</option>
              <option value="Retired">Retired</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Age
            </label>
            <input
              type="number"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
              placeholder="25"
              min="18"
              max="100"
            />
          </div>

          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Annual Income
            </label>
            <input
              type="number"
              value={annualIncome}
              onChange={(e) => setAnnualIncome(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
              placeholder="500000"
              min="0"
            />
          </div>

          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Investment Experience
            </label>
            <select
              value={investmentExperience}
              onChange={(e) => setInvestmentExperience(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
              required
            >
              <option value="Beginner">Beginner</option>
              <option value="Intermediate">Intermediate</option>
              <option value="Expert">Expert</option>
            </select>
          </div>

          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Investment Goals
            </label>
            <textarea
              value={investmentGoals}
              onChange={(e) => setInvestmentGoals(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
              placeholder="E.g., Long-term wealth creation"
              rows={3}
              required
            />
          </div>

          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Risk Appetite
            </label>
            <select
              value={riskAppetite}
              onChange={(e) => setRiskAppetite(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
              required
            >
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
            </select>
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
            {loading ? 'Saving...' : 'Continue to Dashboard'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Onboarding;
