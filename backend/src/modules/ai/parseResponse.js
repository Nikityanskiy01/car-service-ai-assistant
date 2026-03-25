/**
 * @param {string} text
 * @returns {Record<string, unknown>}
 */
export function parseLlmJson(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('Empty LLM response');
  }
  let s = text.trim();
  const fence = s.match(/^```(?:json)?\s*([\s\S]*?)```$/im);
  if (fence) s = fence[1].trim();
  // Some local LLMs occasionally append a trailing comment/text after valid JSON.
  // We attempt to extract the first top-level JSON object.
  const firstBrace = s.indexOf('{');
  if (firstBrace > 0) s = s.slice(firstBrace).trim();
  let candidate = s;
  if (!candidate.startsWith('{')) {
    throw new Error('LLM JSON must start with {');
  }
  let depth = 0;
  let inStr = false;
  let esc = false;
  let end = -1;
  for (let i = 0; i < candidate.length; i++) {
    const ch = candidate[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\\\') esc = true;
      else if (ch === '\"') inStr = false;
      continue;
    }
    if (ch === '\"') {
      inStr = true;
      continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  if (end > 0) candidate = candidate.slice(0, end);
  const parsed = JSON.parse(candidate);
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('LLM JSON must be an object');
  }
  return parsed;
}

/**
 * Normalize parsed LLM object to internal shape.
 * @param {Record<string, unknown>} raw
 */
export function normalizeLlmPayload(raw) {
  const extracted = raw.extracted && typeof raw.extracted === 'object' ? raw.extracted : {};
  const recs = Array.isArray(raw.recommendations) ? raw.recommendations : [];
  const recommendations = recs
    .filter((r) => r && typeof r === 'object')
    .map((r) => ({
      title: String(r.title || 'Рекомендация'),
      probabilityPercent: Math.min(100, Math.max(0, Number(r.probabilityPercent) || 0)),
    }));
  return {
    reply: String(raw.reply || 'Продолжим консультацию.'),
    extracted,
    recommendations,
    progressPercent: Math.min(100, Math.max(0, Number(raw.progressPercent) || 0)),
    confidencePercent:
      raw.confidencePercent != null ? Math.min(100, Math.max(0, Number(raw.confidencePercent))) : null,
    costFromMinor: raw.costFromMinor != null ? Number(raw.costFromMinor) : null,
    preliminaryNote: raw.preliminaryNote != null ? String(raw.preliminaryNote) : null,
  };
}
