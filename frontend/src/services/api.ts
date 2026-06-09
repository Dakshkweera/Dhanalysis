import { fetchWithAuth } from '../utils/fetchWithAuth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export const portfolioAPI = {
  getSummary: async (userId: string) => {
    const response = await fetchWithAuth(`${API_BASE_URL}/portfolio/summary?userId=${userId}`, {
      method: 'GET',
    });
    const data = await response.json();
    if (!response.ok || data.error) {
      throw new Error(data.error || 'Failed to fetch portfolio summary');
    }
    return data;
  },

  getHistory: async (userId: string, days: number | string) => {
    const response = await fetchWithAuth(`${API_BASE_URL}/portfolio/history?userId=${userId}&days=${days}`, {
      method: 'GET',
    });
    const data = await response.json();
    if (!response.ok || data.error) {
      throw new Error(data.error || 'Failed to fetch portfolio history');
    }
    return data;
  },
};
