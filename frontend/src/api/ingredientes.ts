import { api } from './client';
import type { Ingrediente, Paginated } from './types';

export interface IngredienteInput {
  nombre: string;
  descripcion?: string | null;
  es_alergeno: boolean;
  stock_cantidad: number;
  unidad_medida_id: number;
}

export const ingredientesApi = {
  list: (params: { page?: number; size?: number; nombre?: string } = {}) =>
    api
      .get<Paginated<Ingrediente>>('/ingredientes/', { params })
      .then((r) => r.data),

  get: (id: number) =>
    api.get<Ingrediente>(`/ingredientes/${id}`).then((r) => r.data),

  create: (payload: IngredienteInput) =>
    api.post<Ingrediente>('/ingredientes/', payload).then((r) => r.data),

  update: (id: number, payload: IngredienteInput) =>
    api.put<Ingrediente>(`/ingredientes/${id}`, payload).then((r) => r.data),

  remove: (id: number) =>
    api.delete(`/ingredientes/${id}`).then(() => undefined),
};
