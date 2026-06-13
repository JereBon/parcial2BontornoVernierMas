import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

const WS_CATALOGO =
  (import.meta.env.VITE_WS_URL as string | undefined)
    ? `${import.meta.env.VITE_WS_URL}/ws/catalogo`
    : 'ws://localhost:8000/ws/catalogo';

export function useCatalogoFeed() {
  const qc = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountedRef = useRef(false);

  useEffect(() => {
    unmountedRef.current = false;

    function connect() {
      if (unmountedRef.current) return;
      const ws = new WebSocket(WS_CATALOGO);
      wsRef.current = ws;

      ws.onmessage = (evt) => {
        if (unmountedRef.current) return;
        try {
          const data = JSON.parse(evt.data as string) as { event: string };
          if (data.event === 'stock_actualizado') {
            qc.invalidateQueries({ queryKey: ['ingredientes'] });
            qc.invalidateQueries({ queryKey: ['productos'] });
          }
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        if (unmountedRef.current) return;
        retryRef.current = setTimeout(connect, 3_000);
      };

      ws.onerror = () => {
        // onclose fires after onerror
      };
    }

    connect();

    return () => {
      unmountedRef.current = true;
      if (retryRef.current) clearTimeout(retryRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [qc]);
}
