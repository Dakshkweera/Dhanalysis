import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { onAuthStateChanged } from 'firebase/auth';  // ✅ This is from npm package
import type { User } from 'firebase/auth';  // ✅ This is from npm package
import { auth } from '../config/firebase';  // ✅ This is your local config

interface AuthContextType {
  currentUser: User | null;
  userId: string | null;
  token: string | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        setUserId(user.uid);
        
        // Get fresh token
        const idToken = await user.getIdToken();
        setToken(idToken);
        
        // Keep localStorage updated for backward compatibility
        localStorage.setItem('userId', user.uid);
        localStorage.setItem('firebaseToken', idToken);
      } else {
        setCurrentUser(null);
        setUserId(null);
        setToken(null);
        
        // Clear localStorage
        localStorage.removeItem('userId');
        localStorage.removeItem('firebaseToken');
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    userId,
    token,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
