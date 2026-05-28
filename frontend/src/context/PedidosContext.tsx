import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  type ReactNode,
} from 'react';
import { pedidosApi } from '../api/pedidos';
import type { EstadoPedidoCodigo, PedidoFull } from '../models/types';
import {
  pedidosReducer,
  pedidosEstadoInicial,
  type PedidosState,
} from '../reducers/pedidosReducer';

interface PedidosFilters {
  skip?: number;
  limit?: number;
  estado?: EstadoPedidoCodigo;
}

interface PedidosContextValue extends PedidosState {
  cargar: (filters?: PedidosFilters) => Promise<void>;
  cambiarEstado: (id: number, estado: EstadoPedidoCodigo, nota?: string) => Promise<PedidoFull>;
  cancelar: (id: number) => Promise<PedidoFull>;
}

const PedidosContext = createContext<PedidosContextValue | null>(null);

export function PedidosProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(pedidosReducer, pedidosEstadoInicial);

  const cargar = useCallback(async (filters: PedidosFilters = {}) => {
    dispatch({ type: 'CARGAR_INICIO' });
    try {
      const data = await pedidosApi.listAll(filters);
      dispatch({ type: 'CARGAR_EXITO', payload: data });
    } catch (err) {
      dispatch({ type: 'CARGAR_ERROR', payload: (err as Error).message });
    }
  }, []);

  const cambiarEstado = useCallback(
    async (id: number, estado: EstadoPedidoCodigo, nota?: string): Promise<PedidoFull> => {
      const actualizado = await pedidosApi.cambiarEstado(id, estado, nota);
      dispatch({ type: 'ACTUALIZAR', payload: actualizado });
      return actualizado;
    },
    [],
  );

  const cancelar = useCallback(async (id: number): Promise<PedidoFull> => {
    const actualizado = await pedidosApi.cancelar(id);
    dispatch({ type: 'ACTUALIZAR', payload: actualizado });
    return actualizado;
  }, []);

  return (
    <PedidosContext.Provider value={{ ...state, cargar, cambiarEstado, cancelar }}>
      {children}
    </PedidosContext.Provider>
  );
}

export function usePedidos(): PedidosContextValue {
  const ctx = useContext(PedidosContext);
  if (!ctx) throw new Error('usePedidos debe usarse dentro de PedidosProvider');
  return ctx;
}
