/** Short-lived in-memory cache for public CMS fetches (shared across hooks/pages). */

type Entry<T> = { value: T; expiresAt: number };

const store = new Map<string, Entry<unknown>>();
const DEFAULT_TTL_MS = 60_000;

export async function cachedPublicFetch<T>(
  key: string,
  loader: () => Promise<T>,
  ttlMs = DEFAULT_TTL_MS,
): Promise<T> {
  const hit = store.get(key);
  if (hit && Date.now() < hit.expiresAt) {
    return hit.value as T;
  }
  const value = await loader();
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
  return value;
}

export function clearPublicContentCache(): void {
  store.clear();
}
