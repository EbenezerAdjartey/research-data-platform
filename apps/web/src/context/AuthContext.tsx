import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { auth, setTokens, clearTokens, setOnTokenRefresh } from '@rdp/api-client';
import type { User, TokenResponse } from '@rdp/shared-types';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string, institution?: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('rdp_tokens');
    if (stored) {
      const tokens: TokenResponse = JSON.parse(stored);
      setTokens(tokens.access_token, tokens.refresh_token);
      setOnTokenRefresh((t) => localStorage.setItem('rdp_tokens', JSON.stringify(t)));
      auth.getProfile().then(setUser).catch(() => {
        localStorage.removeItem('rdp_tokens');
        clearTokens();
      }).finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const saveTokens = (tokens: TokenResponse) => {
    localStorage.setItem('rdp_tokens', JSON.stringify(tokens));
    setTokens(tokens.access_token, tokens.refresh_token);
    setOnTokenRefresh((t) => localStorage.setItem('rdp_tokens', JSON.stringify(t)));
  };

  const login = async (email: string, password: string) => {
    const tokens = await auth.login({ email, password });
    saveTokens(tokens);
    const profile = await auth.getProfile();
    setUser(profile);
  };

  const register = async (email: string, password: string, fullName: string, institution?: string) => {
    const tokens = await auth.register({ email, password, full_name: fullName, institution });
    saveTokens(tokens);
    const profile = await auth.getProfile();
    setUser(profile);
  };

  const logout = () => {
    const stored = localStorage.getItem('rdp_tokens');
    if (stored) {
      const tokens: TokenResponse = JSON.parse(stored);
      auth.logout(tokens.refresh_token).catch(() => {});
    }
    localStorage.removeItem('rdp_tokens');
    clearTokens();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
