// frontend/src/utils/fetchWithAuth.ts
// Wraps fetch to auto-refresh JWT on 401 and retry the request once.

const getToken = () => localStorage.getItem('firebaseToken');

const refreshAccessToken = async (): Promise<string | null> => {
  try {
    const res  = await fetch(`${import.meta.env.VITE_API_BASE_URL}/auth/refresh`, {
      method:      'POST',
      credentials: 'include',
    });
    const data = await res.json();
    if (data.success && data.accessToken) {
      localStorage.setItem('firebaseToken', data.accessToken);
      localStorage.setItem('accessToken',   data.accessToken);
      const payload = JSON.parse(atob(data.accessToken.split('.')[1]));
      localStorage.setItem('userId',   payload.uid);
      localStorage.setItem('authUser', JSON.stringify({ uid: payload.uid, email: payload.email }));
      return data.accessToken;
    }
    return null;
  } catch {
    return null;
  }
};

export const fetchWithAuth = async (
  url: string,
  options: RequestInit = {}
): Promise<Response> => {
  const token = getToken();

  const authOptions: RequestInit = {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  };

  let response = await fetch(url, authOptions);

  // Auto-refresh on 401 and retry once
  if (response.status === 401) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      response = await fetch(url, {
        ...authOptions,
        headers: {
          ...authOptions.headers,
          Authorization: `Bearer ${newToken}`,
        },
      });
    }
  }

  return response;
};
