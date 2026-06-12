import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../stores/authStore';
import { useWSStore } from '../stores/wsStore';
import { authApi } from '../api/auth';

const WS_BASE = 'ws://localhost:8000/ws/pedidos';
const MAX_RETRIES = 10;
const BASE_DELAY_MS = 1000;

export function useAdminOrdersFeed(): { connected: boolean } {
  const accessToken = useAuthStore((s) => s.accessToken);
  const setAuth = useAuthStore((s) => s.setAuth);
  const user = useAuthStore((s) => s.user);
  const setConnected = useWSStore((s) => s.setConnected);
  const connected = useWSStore((s) => s.connected);
  const queryClient = useQueryClient();

  const wsRef = useRef<WebSocket | null>(null);
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountedRef = useRef(false);

  useEffect(() => {
    unmountedRef.current = false;

    if (!accessToken) {
      setConnected(false);
      return;
    }

    function connect() {
      if (unmountedRef.current) return;

      const ws = new WebSocket(`${WS_BASE}?token=${accessToken}`);
      wsRef.current = ws;

      ws.onopen = () => {
        if (unmountedRef.current) { ws.close(); return; }
        retryCountRef.current = 0;
        setConnected(true);
      };

      ws.onmessage = () => {
        if (unmountedRef.current) return;
        queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      };

      ws.onerror = () => {
        // onclose will handle reconnection
      };

      ws.onclose = async (event) => {
        if (unmountedRef.current) return;
        setConnected(false);

        // Token expired — try refresh then reconnect
        if (event.code === 4001) {
          try {
            const refreshData = await authApi.refresh();
            if (!unmountedRef.current && refreshData.access_token) {
              setAuth(refreshData.access_token, refreshData.user);
              retryCountRef.current = 0;
              connect();
              return;
            }
          } catch {
            // Refresh failed — don't reconnect
            return;
          }
        }

        // Exponential back-off reconnect
        if (retryCountRef.current < MAX_RETRIES) {
          const delay = BASE_DELAY_MS * Math.pow(2, retryCountRef.current);
          retryCountRef.current += 1;
          retryTimeoutRef.current = setTimeout(() => {
            if (!unmountedRef.current) connect();
          }, delay);
        }
      };
    }

    connect();

    return () => {
      unmountedRef.current = true;
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setConnected(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  // If no token and there's no authenticated user, make sure we stay disconnected
  useEffect(() => {
    if (!user && !accessToken) {
      setConnected(false);
    }
  }, [user, accessToken, setConnected]);

  return { connected };
}
