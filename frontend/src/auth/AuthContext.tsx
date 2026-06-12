import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi, type LoginPayload } from '../api/auth';
import type { Usuario } from '../api/types';
import { useAuthStore } from '../stores/authStore';

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
  const queryClient = useQueryClient();
  const setAuth = useAuthStore((s) => s.setAuth);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  const meQuery = useQuery<Usuario | null>({
    queryKey: ['auth', 'me'],
    enabled: hasAuthHint(),
    queryFn: async () => {
      try {
        return await authApi.me();
      } catch (err: unknown) {
        const status = (err as { response?: { status?: number } }).response?.status;
        if (status === 401) {
          setAuthHint(false);
          clearAuth();
          return null;
        }
        throw err;
      }
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const loginMut = useMutation({
    mutationFn: authApi.login,
    onSuccess: (data) => {
      setAuthHint(true);
      setAuth(data.access_token, data.user);
      queryClient.setQueryData(['auth', 'me'], data.user);
    },
  });

  const logoutMut = useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => {
      setAuthHint(false);
      clearAuth();
      queryClient.setQueryData(['auth', 'me'], null);
      queryClient.removeQueries();
    },
  });

  // Keep Zustand user in sync with the me query result
  const meUser = meQuery.data ?? null;

  const value = useMemo<AuthContextValue>(() => {
    const user = meUser;
    const codes = user?.roles.map((r) => r.codigo) ?? [];
    const isLoading = hasAuthHint() && meQuery.isLoading;
    return {
      user,
      isLoading,
      isAuthenticated: user !== null,
      roleCodes: codes,
      hasAnyRole: (...codigos) => codigos.some((c) => codes.includes(c)),
      login: async (payload) => {
        const data = await loginMut.mutateAsync(payload);
        return data.user;
      },
      logout: async () => { await logoutMut.mutateAsync(); },
    };
  }, [meUser, meQuery.isLoading, loginMut, logoutMut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
