export const PLACEHOLDER_FALLBACK = '/placeholders/gallery-01.jpg';

export function normalizeImageUrl(url?: string | null, fallback = PLACEHOLDER_FALLBACK): string {
  if (!url?.trim()) return fallback;
  return url.trim();
}

/** Map local placeholder JPG/PNG to sibling WebP when available. */
export function toWebpUrl(url?: string | null): string | null {
  const src = normalizeImageUrl(url);
  if (!src.startsWith('/placeholders/')) return null;
  if (/\.webp$/i.test(src)) return src;
  if (/\.(jpe?g|png)$/i.test(src)) return src.replace(/\.(jpe?g|png)$/i, '.webp');
  return null;
}
