/**
 * Sanitize a float array into pgvector text input: '[0.1,0.2,...]'.
 * @param vec
 * @returns
 */
export function toVectorLiteral(vec) {
  if (!Array.isArray(vec) || !vec.length) return null;
  const parts = [];
  for (const x of vec) {
    const n = Number(x);
    if (!Number.isFinite(n)) return null;
    parts.push(n.toFixed(8));
  }
  return `[${parts.join(',')}]`;
}
