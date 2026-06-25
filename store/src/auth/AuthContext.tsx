/**
 * AuthContext — thin compatibility shim.
 *
 * The real auth state now lives in useAuthStore (Zustand + persist).
 * This module:
 *  1. Exports `useAuth()` as a backward-compat hook that reads from the store
 *     and wraps mutations, so existing pages keep working without changes.
 *  2. Exports `AuthProvider` that hydrates the store on mount by calling /auth/me
 *     whenever we have a persisted accessToken.
 */
import { useEffect, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi, type LoginPayload, type RegisterPayload } from '../api/auth';
import type { Usuario } from '../api/types';
import { useAuthStore } from '../stores/authStore';
import { useCartStore } from '../stores/cartStore';
import { registerAuthFailureHandler } from '../api/client';

// ── Hydration provider ────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const { accessToken, setAuth, clearAuth, isAuthenticated } = useAuthStore();
  const qc = useQueryClient();

  useEffect(() => {
    registerAuthFailureHandler(() => {
      clearAuth();
      qc.setQueryData(['auth', 'me'], null);
    });
  }, [clearAuth, qc]);

  // Hydrate user from /auth/me on startup if we have a stored token.
  useQuery<Usuario | null>({
    queryKey: ['auth', 'me'],
    enabled: !!accessToken,
    queryFn: async () => {
      try {
        const user = await authApi.me();
        setAuth(accessToken!, user);
        return user;
      } catch (err: unknown) {
        const status = (err as { response?: { status?: number } }).response?.status;
        if (status === 401) {
          clearAuth();
          return null;
        }
        throw err;
      }
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  // Keep queryCache in sync with store on logout
  useEffect(() => {
    if (!isAuthenticated) {
      qc.removeQueries({ queryKey: ['pedidos'] });
    }
  }, [isAuthenticated, qc]);

  return <>{children}</>;
}

// ── Backward-compat hook ──────────────────────────────────────────────────────

interface AuthContextValue {
  user: Usuario | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (payload: LoginPayload) => Promise<Usuario>;
  register: (payload: RegisterPayload) => Promise<Usuario>;
  logout: () => Promise<void>;
}

export function useAuth(): AuthContextValue {
  const { user, accessToken, isAuthenticated, setAuth, clearAuth } = useAuthStore();
  const qc = useQueryClient();

  const meQuery = useQuery<Usuario | null>({
    queryKey: ['auth', 'me'],
    enabled: !!accessToken && !user,
    queryFn: async () => {
      try {
        const u = await authApi.me();
        setAuth(accessToken!, u);
        return u;
      } catch {
        clearAuth();
        return null;
      }
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const loginMut = useMutation({
    mutationFn: authApi.login,
    onSuccess: (data) => {
      setAuth(data.access_token, data.user);
      qc.setQueryData(['auth', 'me'], data.user);
    },
  });

  const registerMut = useMutation({
    mutationFn: async (payload: RegisterPayload) => {
      const created = await authApi.register(payload);
      const loginData = await authApi.login({ email: payload.email, password: payload.password });
      setAuth(loginData.access_token, loginData.user);
      qc.setQueryData(['auth', 'me'], loginData.user);
      return created;
    },
  });

  const logoutMut = useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => {
      useCartStore.getState().clear();
      clearAuth();
      qc.setQueryData(['auth', 'me'], null);
      qc.removeQueries({ queryKey: ['pedidos'] });
    },
  });

  return {
    user,
    isLoading: !!accessToken && !user && meQuery.isLoading,
    isAuthenticated,
    login: async (p) => {
      const data = await loginMut.mutateAsync(p);
      return data.user;
    },
    register: async (p) => registerMut.mutateAsync(p),
    logout: async () => { await logoutMut.mutateAsync(); },
  };
}
