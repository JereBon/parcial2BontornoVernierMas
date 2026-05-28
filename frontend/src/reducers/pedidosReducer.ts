import type { Paginated, Pedido } from '../models/types';

export interface PedidosState {
  pedidos: Pedido[];
  total: number;
  cargando: boolean;
  error: string | null;
}

export type PedidosAction =
  | { type: 'CARGAR_INICIO' }
  | { type: 'CARGAR_EXITO'; payload: Paginated<Pedido> }
  | { type: 'CARGAR_ERROR'; payload: string }
  | { type: 'ACTUALIZAR'; payload: Pedido };

export const pedidosEstadoInicial: PedidosState = {
  pedidos: [],
  total: 0,
  cargando: false,
  error: null,
};

export function pedidosReducer(state: PedidosState, action: PedidosAction): PedidosState {
  switch (action.type) {
    case 'CARGAR_INICIO':
      return { ...state, cargando: true, error: null };
    case 'CARGAR_EXITO':
      return {
        ...state,
        cargando: false,
        pedidos: action.payload.items,
        total: action.payload.total,
      };
    case 'CARGAR_ERROR':
      return { ...state, cargando: false, error: action.payload };
    case 'ACTUALIZAR':
      return {
        ...state,
        pedidos: state.pedidos.map((p) => (p.id === action.payload.id ? action.payload : p)),
      };
    default:
      return state;
  }
}
