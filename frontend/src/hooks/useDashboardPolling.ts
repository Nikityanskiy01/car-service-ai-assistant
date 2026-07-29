import { useEffect } from 'react';

export function useDashboardPolling(callback: () => void | Promise<void>, intervalMs = 60_000) {
  useEffect(() => {
    const id = window.setInterval(() => {
      void callback();
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [callback, intervalMs]);
}
