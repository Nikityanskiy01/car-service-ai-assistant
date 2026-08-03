/** Разрешает только внутренние относительные пути (защита от open redirect). */
export function getSafeInternalPath(next: string | null | undefined): string | null {
  if (!next) return null;
  const value = next.trim();
  if (!value.startsWith('/') || value.startsWith('//')) return null;
  if (value.includes('://') || value.includes('\\')) return null;
  return value;
}
