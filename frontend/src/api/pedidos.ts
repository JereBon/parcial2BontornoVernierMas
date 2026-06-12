import { api } from './client';
import type {
  EstadoPedidoCodigo,
  Paginated,
  Pedido,
  PedidoFull,
} from './types';

export interface PedidoItemInput {
  producto_id: number;
  cantidad: number;
}

export interface PedidoInput {
  direccion_id: number;
  forma_pago_id: number;
  notas?: string | null;
  items: PedidoItemInput[];
}

export interface PedidoFilters {
  page?: number;
  size?: number;
  estado?: EstadoPedidoCodigo;
  usuario_id?: number;
}

export const pedidosApi = {
  listAll: (filters: PedidoFilters = {}) =>
    api.get<Paginated<Pedido>>('/pedidos/', { params: filters }).then((r) => r.data),

  listMine: (filters: Omit<PedidoFilters, 'usuario_id'> = {}) =>
    api.get<Paginated<Pedido>>('/pedidos/me', { params: filters }).then((r) => r.data),

  get: (id: number) =>
    api.get<PedidoFull>(`/pedidos/${id}`).then((r) => r.data),

  create: (payload: PedidoInput) =>
    api.post<PedidoFull>('/pedidos/', payload).then((r) => r.data),

  cambiarEstado: (id: number, estado: EstadoPedidoCodigo, motivo?: string) =>
    api.patch<PedidoFull>(`/pedidos/${id}/estado`, { estado, motivo }).then((r) => r.data),

  cancelar: (id: number, motivo?: string) =>
    api.post<PedidoFull>(`/pedidos/${id}/cancelar`, { motivo }).then((r) => r.data),
};
