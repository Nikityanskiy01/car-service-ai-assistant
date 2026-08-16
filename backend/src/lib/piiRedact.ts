const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_RE = /(?:\+?\d[\d\s().-]{8,}\d)/g;

export function redactPii(text) {
  return String(text || '')
    .replace(EMAIL_RE, '[email]')
    .replace(PHONE_RE, '[phone]');
}

export function redactPiiDeep(value, depth = 0) {
  if (depth > 8) return value;
  if (typeof value === 'string') return redactPii(value);
  if (Array.isArray(value)) return value.map((item) => redactPiiDeep(item, depth + 1));
  if (value && typeof value === 'object') {
    const out: any = {};
    for (const [key, item] of Object.entries(value)) {
      out[key] = redactPiiDeep(item, depth + 1);
    }
    return out;
  }
  return value;
}

export function sanitizeUntrustedPromptText(text, max = 500) {
  return String(text || '')
    .replace(/\b(ignore|забыть|ignore previous|system prompt|jailbreak|you are now)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}
