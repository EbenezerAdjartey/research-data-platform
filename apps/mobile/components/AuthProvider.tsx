import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import type { User, TokenResponse } from '@rdp/shared-types';
import { API_BASE } from '@/config/api';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

async function apiRequest<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...options.headers as any };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) throw new Error(await res.text());
  if (res.status === 204) return undefined as T;
  return res.json();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const stored = await SecureStore.getItemAsync('rdp_tokens');
      if (stored) {
        try {
          const tokens: TokenResponse = JSON.parse(stored);
          const profile = await apiRequest<User>('/auth/me', {}, tokens.access_token);
          setUser(profile);
        } catch {
          await SecureStore.deleteItemAsync('rdp_tokens');
        }
      }
      setIsLoading(false);
    })();
  }, []);

  const login = async (email: string, password: string) => {
    const tokens = await apiRequest<TokenResponse>('/auth/login', {
      method: 'POST', body: JSON.stringify({ email, password }),
    });
    await SecureStore.setItemAsync('rdp_tokens', JSON.stringify(tokens));
    const profile = await apiRequest<User>('/auth/me', {}, tokens.access_token);
    setUser(profile);
  };

  const register = async (email: string, password: string, fullName: string) => {
    const tokens = await apiRequest<TokenResponse>('/auth/register', {
      method: 'POST', body: JSON.stringify({ email, password, full_name: fullName }),
    });
    await SecureStore.setItemAsync('rdp_tokens', JSON.stringify(tokens));
    const profile = await apiRequest<User>('/auth/me', {}, tokens.access_token);
    setUser(profile);
  };

  const logout = async () => {
    await SecureStore.deleteItemAsync('rdp_tokens');
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
