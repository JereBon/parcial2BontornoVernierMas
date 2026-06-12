import axios, { AxiosError } from 'axios';

export const API_BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000/api/v1';

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// Callback registered by the auth layer to clear state on auth failure.
let onAuthFailure: (() => void) | null = null;
export function registerAuthFailureHandler(handler: () => void) {
  onAuthFailure = handler;
}

let isRefreshing = false;
let refreshQueue: Array<(ok: boolean) => void> = [];

function drainQueue(ok: boolean) {
  refreshQueue.forEach((resolve) => resolve(ok));
  refreshQueue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<{ detail?: string }>) => {
    const original = error.config as typeof error.config & { _retry?: boolean };

    const detail = error.response?.data?.detail;
    if (detail) {
      error.message = typeof detail === 'string' ? detail : JSON.stringify(detail);
    }

    if (error.response?.status === 401 && !original?._retry) {
      if (!original) return Promise.reject(error);
      original._retry = true;

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          refreshQueue.push((ok) =>
            ok ? resolve(api(original)) : reject(error),
          );
        });
      }

      isRefreshing = true;
      try {
        // Cookie-based refresh — withCredentials sends the refresh cookie automatically.
        await api.post('/auth/refresh');
        drainQueue(true);
        return api(original);
      } catch {
        drainQueue(false);
        onAuthFailure?.();
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);
