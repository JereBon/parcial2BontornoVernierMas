import { api } from './client';
import type { DireccionEntrega } from './types';

export interface DireccionInput {
  alias: string;
  calle: string;
  numero: string;
  ciudad: string;
  codigo_postal?: string | null;
  detalles?: string | null;
  principal?: boolean;
}

export const direccionesApi = {
  list: () => api.get<DireccionEntrega[]>('/direcciones/').then((r) => r.data),

  create: (payload: DireccionInput) =>
    api.post<DireccionEntrega>('/direcciones/', payload).then((r) => r.data),

  update: (id: number, payload: Partial<DireccionInput>) =>
    api.put<DireccionEntrega>(`/direcciones/${id}`, payload).then((r) => r.data),

  setPrincipal: (id: number) =>
    api.patch<DireccionEntrega>(`/direcciones/${id}/principal`).then((r) => r.data),

  remove: (id: number) =>
    api.delete(`/direcciones/${id}`).then(() => undefined),
};
