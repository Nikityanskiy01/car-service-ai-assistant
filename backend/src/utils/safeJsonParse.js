/**
 * Attempts to parse JSON even if model added extra text.
 * Returns null when parsing fails.
 * @param {string} text
 * @returns {Record<string, unknown> | null}
 */
export function safeJsonParse(text) {
  const s0 = String(text || '').trim();
  if (!s0) return null;
  let s = s0;
  const fence = s.match(/^```(?:json)?\s*([\s\S]*?)```$/im);
  if (fence) s = fence[1].trim();
  const start = s.indexOf('{');
  if (start < 0) return null;
  s = s.slice(start);

  let depth = 0;
  let inStr = false;
  let esc = false;
  let end = -1;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') {
      inStr = true;
      continue;
    }
    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  if (end < 0) return null;
  try {
    const parsed = JSON.parse(s.slice(0, end));
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}
