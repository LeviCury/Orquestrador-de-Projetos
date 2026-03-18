import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { Collaborator } from '@/types';
import { getMe } from '@/api/client';

interface AuthState {
  user: Collaborator | null;
  loading: boolean;
  authenticated: boolean;
  login: (token: string, user: Collaborator) => void;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  authenticated: false,
  login: () => {},
  logout: () => {},
  refresh: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Collaborator | null>(null);
  const [loading, setLoading] = useState(true);

  const login = useCallback((token: string, userData: Collaborator) => {
    localStorage.setItem('auth_token', token);
    const minimal = { id: userData.id, name: userData.name, system_role: userData.system_role, is_admin: userData.is_admin };
    localStorage.setItem('auth_user_min', JSON.stringify(minimal));
    localStorage.removeItem('auth_user');
    setUser(userData);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    localStorage.removeItem('auth_user_min');
    setUser(null);
    window.location.href = '/login';
  }, []);

  const refresh = useCallback(async () => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await getMe();
      setUser(me);
      const minimal = { id: me.id, name: me.name, system_role: me.system_role, is_admin: me.is_admin };
      localStorage.setItem('auth_user_min', JSON.stringify(minimal));
    } catch {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      localStorage.removeItem('auth_user_min');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const cached = localStorage.getItem('auth_user_min');
    if (cached) {
      try {
        const min = JSON.parse(cached);
        setUser({ ...min } as Collaborator);
      } catch { /* ignore */ }
    }
    refresh();
  }, [refresh]);

  return (
    <AuthContext.Provider value={{ user, loading, authenticated: !!user, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
