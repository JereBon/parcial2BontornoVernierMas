import { create } from 'zustand';
import type { WSEvento } from '../hooks/useOrderStatusWS';

interface OrderStatusState {
  events: Record<number, WSEvento>;
  setEvent: (pedidoId: number, event: WSEvento) => void;
  clearEvent: (pedidoId: number) => void;
}

export const useOrderStatusStore = create<OrderStatusState>()((set) => ({
  events: {},
  setEvent: (pedidoId, event) =>
    set((s) => ({ events: { ...s.events, [pedidoId]: event } })),
  clearEvent: (pedidoId) =>
    set((s) => {
      const next = { ...s.events };
      delete next[pedidoId];
      return { events: next };
    }),
}));
