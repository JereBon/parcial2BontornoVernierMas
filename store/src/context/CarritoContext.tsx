import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from 'react';
import {
  carritoReducer,
  cargarCarritoDesdeStorage,
  CARRITO_STORAGE_KEY,
  type CartItem,
} from '../reducers/carritoReducer';

interface CarritoContextValue {
  items: CartItem[];
  itemCount: number;
  total: number;
  addItem: (item: Omit<CartItem, 'cantidad'>, cantidad?: number) => void;
  removeItem: (producto_id: number) => void;
  setQty: (producto_id: number, cantidad: number) => void;
  setPrice: (producto_id: number, precio: number, nombre?: string) => void;
  clear: () => void;
}

const CarritoContext = createContext<CarritoContextValue | null>(null);

export function CarritoProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(carritoReducer, undefined, cargarCarritoDesdeStorage);

  useEffect(() => {
    try {
      window.localStorage.setItem(CARRITO_STORAGE_KEY, JSON.stringify(state));
    } catch {
      // storage not available
    }
  }, [state]);

  const addItem = useCallback(
    (item: Omit<CartItem, 'cantidad'>, cantidad?: number) =>
      dispatch({ type: 'AGREGAR', item, cantidad }),
    [],
  );

  const removeItem = useCallback(
    (producto_id: number) => dispatch({ type: 'QUITAR', producto_id }),
    [],
  );

  const setQty = useCallback(
    (producto_id: number, cantidad: number) =>
      dispatch({ type: 'SET_CANTIDAD', producto_id, cantidad }),
    [],
  );

  const setPrice = useCallback(
    (producto_id: number, precio: number, nombre?: string) =>
      dispatch({ type: 'SET_PRECIO', producto_id, precio, nombre }),
    [],
  );

  const clear = useCallback(() => dispatch({ type: 'VACIAR' }), []);

  const value = useMemo<CarritoContextValue>(() => {
    const itemCount = state.items.reduce((acc, i) => acc + i.cantidad, 0);
    const total = state.items.reduce((acc, i) => acc + i.precio * i.cantidad, 0);
    return {
      items: state.items,
      itemCount,
      total: Math.round(total * 100) / 100,
      addItem,
      removeItem,
      setQty,
      setPrice,
      clear,
    };
  }, [state.items, addItem, removeItem, setQty, setPrice, clear]);

  return <CarritoContext.Provider value={value}>{children}</CarritoContext.Provider>;
}

export function useCarrito(): CarritoContextValue {
  const ctx = useContext(CarritoContext);
  if (!ctx) throw new Error('useCarrito debe usarse dentro de CarritoProvider');
  return ctx;
}
