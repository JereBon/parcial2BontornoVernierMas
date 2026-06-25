import { api } from './client';
import type { Paginated, UsuarioAdmin } from './types';

export interface UsuarioAdminCreateInput {
  email: string;
  nombre: string;
  apellido: string;
  celular?: string;
  password: string;
  roles: string[];
}

export interface UsuarioAdminUpdateInput {
  nombre?: string;
  apellido?: string;
  celular?: string;
  password?: string;
}

export const adminApi = {
  listUsuarios: (params: { page?: number; size?: number; rol?: string; busqueda?: string } = {}) =>
    api.get<Paginated<UsuarioAdmin>>('/admin/usuarios', { params }).then((r) => r.data),

  getUsuario: (id: number) =>
    api.get<UsuarioAdmin>(`/admin/usuarios/${id}`).then((r) => r.data),

  createUsuario: (payload: UsuarioAdminCreateInput) =>
    api.post<UsuarioAdmin>('/admin/usuarios', payload).then((r) => r.data),

  updateUsuario: (id: number, payload: UsuarioAdminUpdateInput) =>
    api.patch<UsuarioAdmin>(`/admin/usuarios/${id}`, payload).then((r) => r.data),

  replaceRoles: (id: number, roles: string[]) =>
    api.put<UsuarioAdmin>(`/admin/usuarios/${id}/roles`, { roles }).then((r) => r.data),

  removeUsuario: (id: number) =>
    api.delete(`/admin/usuarios/${id}`).then(() => undefined),
};
