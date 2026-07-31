export const PLACEHOLDER_FALLBACK = '/placeholders/gallery-01.jpg';

export function normalizeImageUrl(url?: string | null, fallback = PLACEHOLDER_FALLBACK): string {
  if (!url?.trim()) return fallback;
  return url.trim();
}
