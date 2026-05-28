import { api } from './client';
import type { Ingrediente, Paginated } from './types';

export interface IngredienteInput {
  nombre: string;
}

export const ingredientesApi = {
  list: (params: { skip?: number; limit?: number } = {}) =>
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
