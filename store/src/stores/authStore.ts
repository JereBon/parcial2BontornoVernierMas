import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Usuario } from '../api/types';

interface AuthState {
  accessToken: string | null;
  user: Usuario | null;
  isAuthenticated: boolean;
  setAuth: (token: string, user: Usuario) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      user: null,
      isAuthenticated: false,
      setAuth: (token, user) => set({ accessToken: token, user, isAuthenticated: true }),
      clearAuth: () => set({ accessToken: null, user: null, isAuthenticated: false }),
    }),
    {
      name: 'foodstore_auth',
      partialize: (s) => ({ accessToken: s.accessToken }),
    }
  )
);
