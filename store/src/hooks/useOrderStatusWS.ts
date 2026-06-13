import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { authApi } from '../api/auth';
import { useAuthStore } from '../stores/authStore';
import { useWSStore } from '../stores/wsStore';
import { useOrderStatusStore } from '../stores/orderStatusStore';

export interface WSEvento {
  event: string;
  pedido_id: number;
  estado_anterior: string | null;
  estado_nuevo: string;
  usuario_id: number | null;
  motivo: string | null;
  timestamp: string;
}

const WS_BASE_URL =
  (import.meta.env.VITE_WS_URL as string | undefined) ?? 'ws://localhost:8000';

const MAX_ATTEMPTS = 10;

export function useOrderStatusWS(pedidoId: number | undefined) {
  const qc = useQueryClient();
  const connected = useWSStore((s) => s.connected);
  const setConnected = useWSStore((s) => s.setConnected);
  const setEvent = useOrderStatusStore((s) => s.setEvent);
  const lastStoredEvent = useOrderStatusStore(
    (s) => (pedidoId ? s.events[pedidoId] ?? null : null),
  );
  const [lastEvent, setLastEvent] = useState<WSEvento | null>(lastStoredEvent);

  // Reactivo al token: si el token llega después del primer render (rehydration),
  // el efecto se re-ejecuta y conecta el WS.
  const accessToken = useAuthStore((s) => s.accessToken);

  const attemptRef = useRef(0);
  const wsRef = useRef<WebSocket | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountedRef = useRef(false);

  useEffect(() => {
    if (!pedidoId || Number.isNaN(pedidoId)) return;
    if (!accessToken) return;

    unmountedRef.current = false;
    attemptRef.current = 0;

    function connect() {
      if (unmountedRef.current) return;

      const token = useAuthStore.getState().accessToken;
      if (!token) return;

      const url = `${WS_BASE_URL}/ws/pedidos/${pedidoId}?token=${encodeURIComponent(token)}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (unmountedRef.current) { ws.close(); return; }
        attemptRef.current = 0;
        setConnected(true);
      };

      ws.onmessage = (evt) => {
        if (unmountedRef.current) return;
        try {
          const data = JSON.parse(evt.data as string) as WSEvento;
          setLastEvent(data);
          setEvent(data.pedido_id, data);
          qc.invalidateQueries({ queryKey: ['pedidos', pedidoId] });
          qc.invalidateQueries({ queryKey: ['pedidos', 'mine'] });
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = async (evt) => {
        if (unmountedRef.current) return;
        setConnected(false);
        wsRef.current = null;

        // 4001 = el backend rechazó el token explícitamente → intentar refresh
        // Para cualquier otro código (1006 blip de red, 1005, 1000, etc.) → solo reconectar
        // NO llamar clearAuth() por un blip de red: eso borra la sesión del usuario
        if (evt.code === 4001) {
          try {
            const refreshData = await authApi.refresh();
            const user = await authApi.me();
            useAuthStore.getState().setAuth(refreshData.access_token, user);
            if (!unmountedRef.current) scheduleReconnect();
          } catch {
            useAuthStore.getState().clearAuth();
          }
          return;
        }

        scheduleReconnect();
      };

      ws.onerror = () => {
        // onclose will fire after onerror
      };
    }

    function scheduleReconnect() {
      if (unmountedRef.current) return;
      if (attemptRef.current >= MAX_ATTEMPTS) return;

      const delay = Math.min(30_000, 1000 * Math.pow(2, attemptRef.current));
      attemptRef.current += 1;

      timeoutRef.current = setTimeout(() => {
        if (!unmountedRef.current) connect();
      }, delay);
    }

    connect();

    return () => {
      unmountedRef.current = true;
      if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
      setConnected(false);
    };
  }, [pedidoId, qc, setConnected, accessToken]);

  return { connected, lastEvent };
}
