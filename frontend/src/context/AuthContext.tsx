import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';

interface AuthUser {
  uid:   string;
  email: string;
  name?: string;
}

interface AuthContextType {
  currentUser: AuthUser | null;
  userId:      string | null;
  token:       string | null;
  loading:     boolean;
  login:       (accessToken: string, user: AuthUser) => void;
  logout:      () => Promise<void>;
  refreshToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [token,       setToken]       = useState<string | null>(null);
  const [loading,     setLoading]     = useState(true);

  // ── Restore session on mount ──────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      const storedToken = localStorage.getItem('accessToken');
      const storedUser  = localStorage.getItem('authUser');

      if (storedToken && storedUser) {
        try {
          // Verify token is not expired by checking payload
          const payload = JSON.parse(atob(storedToken.split('.')[1]));
          const isExpired = payload.exp * 1000 < Date.now();

          if (isExpired) {
            // Try silent refresh via HttpOnly cookie
            const newToken = await silentRefresh();
            if (!newToken) {
              clearAuth();
              setLoading(false);
              return;
            }
          } else {
            const user = JSON.parse(storedUser);
            setToken(storedToken);
            setCurrentUser(user);
          }
        } catch {
          clearAuth();
        }
      }
      setLoading(false);
    };

    init();
  }, []);

  // ── Silent refresh (reads HttpOnly cookie, no JS access needed) ──────────
  const silentRefresh = async (): Promise<string | null> => {
    try {
      const res  = await fetch(`${import.meta.env.VITE_API_BASE_URL}/auth/refresh`, {
        method:      'POST',
        credentials: 'include', // sends HttpOnly cookie automatically
      });
      const data = await res.json();

      if (data.success && data.accessToken) {
        const payload = JSON.parse(atob(data.accessToken.split('.')[1]));
        const user    = { uid: payload.uid, email: payload.email };
        setToken(data.accessToken);
        setCurrentUser(user);
        localStorage.setItem('accessToken',   data.accessToken);
        localStorage.setItem('firebaseToken', data.accessToken); // keep in sync
        localStorage.setItem('authUser',      JSON.stringify(user));
        localStorage.setItem('userId',        user.uid);
        return data.accessToken;
      }
      return null;
    } catch {
      return null;
    }
  };

  // ── Auto-refresh 2 min before expiry ─────────────────────────────────────
  useEffect(() => {
    if (!token) return;

    try {
      const payload   = JSON.parse(atob(token.split('.')[1]));
      const expiresIn = payload.exp * 1000 - Date.now() - 2 * 60 * 1000; // 2 min before
      if (expiresIn <= 0) return;

      const timer = setTimeout(() => silentRefresh(), expiresIn);
      return () => clearTimeout(timer);
    } catch {
      return;
    }
  }, [token]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const clearAuth = () => {
    setCurrentUser(null);
    setToken(null);
    localStorage.removeItem('accessToken');
    localStorage.removeItem('authUser');
    // Keep userId for backward compat with old code that reads it directly
    localStorage.removeItem('userId');
  };

  const login = useCallback((accessToken: string, user: AuthUser) => {
    setToken(accessToken);
    setCurrentUser(user);
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('authUser',    JSON.stringify(user));
    localStorage.setItem('userId',      user.uid);
    // keep firebaseToken key for backward compat with api.ts and other files
    localStorage.setItem('firebaseToken', accessToken);
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch(`${import.meta.env.VITE_API_BASE_URL}/auth/logout`, {
        method:      'POST',
        credentials: 'include',
      });
    } catch { /* ignore network errors on logout */ }
    clearAuth();
    localStorage.removeItem('firebaseToken');
  }, []);

  const refreshToken = useCallback(async () => {
    return silentRefresh();
  }, []);

  return (
    <AuthContext.Provider value={{
      currentUser,
      userId:  currentUser?.uid ?? null,
      token,
      loading,
      login,
      logout,
      refreshToken,
    }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
