import { api } from './client';
import type { Paginated, Producto } from './types';

export interface ProductoIngredienteInput {
  ingrediente_id: number;
  es_alergeno: boolean;
}

export interface ProductoInput {
  nombre: string;
  precio: number;
  descripcion?: string | null;
  stock_cantidad: number;
  disponible: boolean;
  categorias_ids: number[];
  ingredientes: ProductoIngredienteInput[];
}

export interface ProductoFilters {
  skip?: number;
  limit?: number;
  nombre?: string;
  categoria_id?: number;
  disponible?: boolean;
  precio_min?: number;
  precio_max?: number;
}

export interface DisponibilidadInput {
  disponible?: boolean;
  stock_cantidad?: number;
}

export const productosApi = {
  list: (filters: ProductoFilters = {}) =>
    api.get<Paginated<Producto>>('/productos/', { params: filters }).then((r) => r.data),

  get: (id: number) =>
    api.get<Producto>(`/productos/${id}`).then((r) => r.data),

  create: (payload: ProductoInput) =>
    api.post<Producto>('/productos/', payload).then((r) => r.data),

  update: (id: number, payload: ProductoInput) =>
    api.put<Producto>(`/productos/${id}`, payload).then((r) => r.data),

  patchDisponibilidad: (id: number, payload: DisponibilidadInput) =>
    api.patch<Producto>(`/productos/${id}/disponibilidad`, payload).then((r) => r.data),

  remove: (id: number) =>
    api.delete(`/productos/${id}`).then(() => undefined),
};
