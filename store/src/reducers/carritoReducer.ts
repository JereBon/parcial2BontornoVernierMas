export interface CartItem {
  producto_id: number;
  nombre: string;
  precio: number;
  cantidad: number;
}

export interface CarritoState {
  items: CartItem[];
}

export type CarritoAction =
  | { type: 'AGREGAR'; item: Omit<CartItem, 'cantidad'>; cantidad?: number }
  | { type: 'QUITAR'; producto_id: number }
  | { type: 'SET_CANTIDAD'; producto_id: number; cantidad: number }
  | { type: 'SET_PRECIO'; producto_id: number; precio: number; nombre?: string }
  | { type: 'VACIAR' }
  | { type: 'HIDRATAR'; state: CarritoState };

export const carritoEstadoInicial: CarritoState = { items: [] };

export function carritoReducer(state: CarritoState, action: CarritoAction): CarritoState {
  switch (action.type) {
    case 'AGREGAR': {
      const qty = Math.max(1, action.cantidad ?? 1);
      const existing = state.items.find((i) => i.producto_id === action.item.producto_id);
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.producto_id === action.item.producto_id
              ? { ...i, cantidad: i.cantidad + qty }
              : i,
          ),
        };
      }
      return { items: [...state.items, { ...action.item, cantidad: qty }] };
    }
    case 'QUITAR':
      return { items: state.items.filter((i) => i.producto_id !== action.producto_id) };
    case 'SET_CANTIDAD':
      if (action.cantidad <= 0) {
        return { items: state.items.filter((i) => i.producto_id !== action.producto_id) };
      }
      return {
        items: state.items.map((i) =>
          i.producto_id === action.producto_id ? { ...i, cantidad: action.cantidad } : i,
        ),
      };
    case 'SET_PRECIO':
      return {
        items: state.items.map((i) =>
          i.producto_id === action.producto_id
            ? { ...i, precio: action.precio, nombre: action.nombre ?? i.nombre }
            : i,
        ),
      };
    case 'VACIAR':
      return { items: [] };
    case 'HIDRATAR':
      return action.state;
    default:
      return state;
  }
}

const STORAGE_KEY = 'foodstore_cart_v1';

export function cargarCarritoDesdeStorage(): CarritoState {
  if (typeof window === 'undefined') return carritoEstadoInicial;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return carritoEstadoInicial;
    const parsed = JSON.parse(raw) as CarritoState;
    if (!parsed || !Array.isArray(parsed.items)) return carritoEstadoInicial;
    return parsed;
  } catch {
    return carritoEstadoInicial;
  }
}

export { STORAGE_KEY as CARRITO_STORAGE_KEY };
