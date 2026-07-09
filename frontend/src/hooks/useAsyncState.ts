import { useEffect, useRef, useState } from 'react';

export function useAsyncState<T>(loader: () => Promise<T>): {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => Promise<void>;
} {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const loaderRef = useRef(loader);

  useEffect(() => {
    loaderRef.current = loader;
  }, [loader]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await loaderRef.current();
        if (!cancelled) setData(response);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Ошибка загрузки');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      const response = await loaderRef.current();
      setData(response);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }

  return { data, error, loading, reload };
}
