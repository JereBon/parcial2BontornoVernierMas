import type { Paginated, Producto } from '../models/types';

export interface ProductosState {
  productos: Producto[];
  total: number;
  cargando: boolean;
  error: string | null;
}

export type ProductosAction =
  | { type: 'CARGAR_INICIO' }
  | { type: 'CARGAR_EXITO'; payload: Paginated<Producto> }
  | { type: 'CARGAR_ERROR'; payload: string }
  | { type: 'AGREGAR'; payload: Producto }
  | { type: 'ACTUALIZAR'; payload: Producto }
  | { type: 'ELIMINAR'; payload: number };

export const productosEstadoInicial: ProductosState = {
  productos: [],
  total: 0,
  cargando: false,
  error: null,
};

export function productosReducer(state: ProductosState, action: ProductosAction): ProductosState {
  switch (action.type) {
    case 'CARGAR_INICIO':
      return { ...state, cargando: true, error: null };
    case 'CARGAR_EXITO':
      return {
        ...state,
        cargando: false,
        productos: action.payload.items,
        total: action.payload.total,
      };
    case 'CARGAR_ERROR':
      return { ...state, cargando: false, error: action.payload };
    case 'AGREGAR':
      return { ...state, productos: [...state.productos, action.payload], total: state.total + 1 };
    case 'ACTUALIZAR':
      return {
        ...state,
        productos: state.productos.map((p) => (p.id === action.payload.id ? action.payload : p)),
      };
    case 'ELIMINAR':
      return {
        ...state,
        productos: state.productos.filter((p) => p.id !== action.payload),
        total: state.total - 1,
      };
    default:
      return state;
  }
}
