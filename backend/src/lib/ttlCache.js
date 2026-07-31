/**
 * Tiny in-process TTL cache (Map). Suitable for hot public reads / auth lookups.
 * Not shared across processes — fine for single-replica demo.
 */

/**
 * @template T
 * @param {number} defaultTtlMs
 */
export function createTtlCache(defaultTtlMs = 30_000) {
  /** @type {Map<string, { value: T, expiresAt: number }>} */
  const store = new Map();

  /**
   * @param {string} key
   * @returns {T | undefined}
   */
  function get(key) {
    const hit = store.get(key);
    if (!hit) return undefined;
    if (Date.now() > hit.expiresAt) {
      store.delete(key);
      return undefined;
    }
    return hit.value;
  }

  /**
   * @param {string} key
   * @param {T} value
   * @param {number} [ttlMs]
   */
  function set(key, value, ttlMs = defaultTtlMs) {
    store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  /** @param {string} key */
  function del(key) {
    store.delete(key);
  }

  function clear() {
    store.clear();
  }

  return { get, set, del, clear };
}
