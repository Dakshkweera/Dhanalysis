const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const getAuthHeaders = () => {
  const token = localStorage.getItem('firebaseToken');
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
};

export const portfolioAPI = {
  getSummary: async (userId: string) => {
    const response = await fetch(`${API_BASE_URL}/portfolio/summary?userId=${userId}`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    const data = await response.json();
    if (!response.ok || data.error) {
      throw new Error(data.error || 'Failed to fetch portfolio summary');
    }
    return data;
  },

  getHistory: async (userId: string, days: number | string) => {
    const response = await fetch(`${API_BASE_URL}/portfolio/history?userId=${userId}&days=${days}`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    const data = await response.json();
    if (!response.ok || data.error) {
      throw new Error(data.error || 'Failed to fetch portfolio history');
    }
    return data;
  },
};
