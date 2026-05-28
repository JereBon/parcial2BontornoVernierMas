import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import { authApi, type LoginPayload } from '../api/auth';
import type { Usuario } from '../models/types';

const AUTH_HINT_KEY = 'admin_auth_hint';
const hasAuthHint = () =>
  typeof window !== 'undefined' && window.localStorage.getItem(AUTH_HINT_KEY) === '1';
const setAuthHint = (v: boolean) => {
  if (typeof window === 'undefined') return;
  if (v) window.localStorage.setItem(AUTH_HINT_KEY, '1');
  else window.localStorage.removeItem(AUTH_HINT_KEY);
};

interface AuthContextValue {
  user: Usuario | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  roleCodes: string[];
  hasAnyRole: (...codes: string[]) => boolean;
  login: (payload: LoginPayload) => Promise<Usuario>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Usuario | null>(null);
  const [isLoading, setIsLoading] = useState(hasAuthHint());

  useEffect(() => {
    if (!hasAuthHint()) return;
    authApi
      .me()
      .then((u) => setUser(u))
      .catch(() => {
        setAuthHint(false);
        setUser(null);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (payload: LoginPayload): Promise<Usuario> => {
    const data = await authApi.login(payload);
    setAuthHint(true);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
    setAuthHint(false);
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const codes = user?.roles.map((r) => r.codigo) ?? [];
    return {
      user,
      isLoading,
      isAuthenticated: user !== null,
      roleCodes: codes,
      hasAnyRole: (...codigos) => codigos.some((c) => codes.includes(c)),
      login,
      logout,
    };
  }, [user, isLoading, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
