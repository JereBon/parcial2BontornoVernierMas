import { api } from './client';
import type { Usuario } from './types';

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload extends LoginPayload {
  nombre: string;
  apellido: string;
  celular?: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: Usuario;
}

export interface RefreshResponse {
  access_token: string;
  token_type: string;
}

export const authApi = {
  login: (payload: LoginPayload) =>
    api.post<LoginResponse>('/auth/login', payload).then((r) => r.data),

  register: (payload: RegisterPayload) =>
    api.post<Usuario>('/auth/register', payload).then((r) => r.data),

  logout: () => api.post('/auth/logout').then(() => undefined),

  me: () => api.get<Usuario>('/auth/me').then((r) => r.data),

  refresh: () =>
    api.post<RefreshResponse>('/auth/refresh').then((r) => r.data),
};
