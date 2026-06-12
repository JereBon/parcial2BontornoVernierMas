import { api } from './client';
import type { EstadoPedidoCodigo, Paginated, Pedido, PedidoFull } from './types';

export interface PedidoItemInput {
  producto_id: number;
  cantidad: number;
  personalizacion?: number[] | null;
}

export interface PedidoInput {
  direccion_id: number;
  forma_pago_id: number;
  notas?: string | null;
  items: PedidoItemInput[];
}

export interface PedidoFilters {
  skip?: number;
  limit?: number;
  estado?: EstadoPedidoCodigo;
}

export const pedidosApi = {
  listMine: (filters: PedidoFilters = {}) =>
    api.get<Paginated<Pedido>>('/pedidos/me', { params: filters }).then((r) => r.data),

  get: (id: number) =>
    api.get<PedidoFull>(`/pedidos/${id}`).then((r) => r.data),

  create: (payload: PedidoInput) =>
    api.post<PedidoFull>('/pedidos/', payload).then((r) => r.data),

  cancelar: (id: number, motivo?: string) =>
    api.post<PedidoFull>(`/pedidos/${id}/cancelar`, { motivo }).then((r) => r.data),

  mpPreference: (id: number) =>
    api.post<{ preference_id: string; init_point: string }>(`/pedidos/${id}/mp-preference`).then((r) => r.data),
};
