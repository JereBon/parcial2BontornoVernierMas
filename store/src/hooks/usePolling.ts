import { useEffect } from 'react';

export function usePolling(callback: () => void, intervaloMs: number) {
  useEffect(() => {
    const id = setInterval(callback, intervaloMs);
    return () => clearInterval(id);
  }, [callback, intervaloMs]);
}
