import { api } from './client';
import type { Categoria, CategoriaTreeNode, Paginated } from './types';

export interface CategoriaInput {
  nombre: string;
  descripcion?: string | null;
  parent_id?: number | null;
  imagen_url?: string | null;
}

export interface CategoriaFilters {
  skip?: number;
  limit?: number;
  parent_id?: number;
  only_roots?: boolean;
}

export const categoriasApi = {
  list: (params: CategoriaFilters = {}) =>
    api.get<Paginated<Categoria>>('/categorias/', { params }).then((r) => r.data),

  tree: () =>
    api.get<CategoriaTreeNode[]>('/categorias/tree').then((r) => r.data),

  get: (id: number) =>
    api.get<Categoria>(`/categorias/${id}`).then((r) => r.data),

  create: (payload: CategoriaInput) =>
    api.post<Categoria>('/categorias/', payload).then((r) => r.data),

  update: (id: number, payload: CategoriaInput) =>
    api.put<Categoria>(`/categorias/${id}`, payload).then((r) => r.data),

  remove: (id: number) =>
    api.delete(`/categorias/${id}`).then(() => undefined),
};
