import axios, { AxiosError } from 'axios';

export const API_BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000/api/v1';

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ detail?: string }>) => {
    const detail = error.response?.data?.detail;
    if (detail) {
      error.message = typeof detail === 'string' ? detail : JSON.stringify(detail);
    }
    return Promise.reject(error);
  },
);
