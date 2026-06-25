import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

const WS_BASE_URL =
  (import.meta.env.VITE_WS_URL as string | undefined) ?? 'ws://localhost:8000';

const MAX_ATTEMPTS = 10;

export function useCatalogoWS() {
  const qc = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountedRef = useRef(false);
  const attemptRef = useRef(0);

  useEffect(() => {
    unmountedRef.current = false;
    attemptRef.current = 0;

    function connect() {
      if (unmountedRef.current) return;

      const ws = new WebSocket(`${WS_BASE_URL}/ws/catalogo`);
      wsRef.current = ws;

      ws.onopen = () => {
        if (unmountedRef.current) { ws.close(); return; }
        attemptRef.current = 0;
      };

      ws.onmessage = () => {
        if (unmountedRef.current) return;
        qc.invalidateQueries({ queryKey: ['catalogo', 'productos'] });
      };

      ws.onclose = () => {
        if (unmountedRef.current) return;
        wsRef.current = null;
        scheduleReconnect();
      };

      ws.onerror = () => {
        // onclose fires after onerror
      };
    }

    function scheduleReconnect() {
      if (unmountedRef.current || attemptRef.current >= MAX_ATTEMPTS) return;
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
    };
  }, [qc]);
}
