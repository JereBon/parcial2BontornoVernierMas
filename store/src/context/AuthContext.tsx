import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { authApi, type LoginPayload, type RegisterPayload } from '../api/auth';
import type { Usuario } from '../models/types';

const AUTH_HINT_KEY = 'store_auth_hint';
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
  login: (payload: LoginPayload) => Promise<Usuario>;
  register: (payload: RegisterPayload) => Promise<Usuario>;
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
      .then(setUser)
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

  const register = useCallback(async (payload: RegisterPayload): Promise<Usuario> => {
    const created = await authApi.register(payload);
    await authApi.login({ email: payload.email, password: payload.password });
    setAuthHint(true);
    setUser(created);
    return created;
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
    setAuthHint(false);
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isAuthenticated: user !== null,
      login,
      register,
      logout,
    }),
    [user, isLoading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
