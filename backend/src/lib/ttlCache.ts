/**
 * Tiny in-process TTL cache (Map). Suitable for hot public reads / auth lookups.
 * Not shared across processes — fine for single-replica demo.
 */

export function createTtlCache<T>(defaultTtlMs = 30_000) {
  const store = new Map<string, { value: T; expiresAt: number }>();

  function get(key: string): T | undefined {
    const hit = store.get(key);
    if (!hit) return undefined;
    if (Date.now() > hit.expiresAt) {
      store.delete(key);
      return undefined;
    }
    return hit.value;
  }

  function set(key: string, value: T, ttlMs = defaultTtlMs) {
    store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  function del(key: string) {
    store.delete(key);
  }

  function clear() {
    store.clear();
  }

  return { get, set, del, clear };
}
