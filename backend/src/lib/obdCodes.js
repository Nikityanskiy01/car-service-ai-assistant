const OBD_PATTERN = /\b([PCBU][0-3][0-9A-F]{3})\b/gi;

/**
 * @param {string} text
 * @returns {string[]}
 */
export function parseObdCodes(text) {
  const found = new Set();
  const src = String(text || '');
  let match;
  const re = new RegExp(OBD_PATTERN.source, 'gi');
  while ((match = re.exec(src)) !== null) {
    found.add(String(match[1]).toUpperCase());
  }
  return [...found];
}

/**
 * @param {string[]|string|null|undefined} codes
 */
export function formatObdCodesString(codes) {
  const list = Array.isArray(codes) ? codes : parseObdCodes(String(codes || ''));
  return [...new Set(list.map((c) => String(c).toUpperCase()))].sort().join(', ');
}

/**
 * @param {string|null|undefined} a
 * @param {string|null|undefined} b
 */
export function mergeObdCodesString(a, b) {
  const merged = [...parseObdCodes(a), ...parseObdCodes(b)];
  const s = formatObdCodesString(merged);
  return s || null;
}
