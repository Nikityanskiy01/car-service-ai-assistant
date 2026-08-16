/**
 * Vector math for case memory (JSON-stored embeddings).
 */

/**
 * @param raw
 * @returns
 */
export function toFloatVector(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x) => x !== null && x !== undefined && x !== '')
    .map((x) => Number(x))
    .filter((x) => Number.isFinite(x));
}

/**
 * @param a
 * @param b
 */
export function cosineSimilarity(a, b) {
  if (!a.length || !b.length || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/**
 * Deterministic pseudo-embedding for tests (no external API).
 * @param text
 * @param dimensions
 */
export function pseudoEmbedding(text, dimensions = 64) {
  const out = new Array(dimensions).fill(0);
  const s = String(text || '').toLowerCase();
  for (let i = 0; i < s.length; i += 1) {
    const code = s.charCodeAt(i);
    out[i % dimensions] += (code % 97) / 97;
  }
  const norm = Math.sqrt(out.reduce((sum, x) => sum + x * x, 0)) || 1;
  return out.map((x) => x / norm);
}
