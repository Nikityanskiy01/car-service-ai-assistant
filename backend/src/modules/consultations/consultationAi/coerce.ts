/**
 * LLM иногда кладёт в массив объекты вида { title, name, ... } вместо строк.
 * Прямой String(obj) даёт "[object Object]" в UI и в БД.
 * @param x
 * @returns
 */
export function coerceDiagnosisLine(x) {
  if (x == null) return '';
  if (typeof x === 'string') {
    const t = x.trim();
    if (t === '[object Object]' || /^object\s+object$/i.test(t)) return '';
    return t;
  }
  if (typeof x === 'number' && Number.isFinite(x)) return String(x);
  if (typeof x === 'object') {
    const o = /** @type */ (x);
    const cand = o.title ?? o.name ?? o.text ?? o.cause ?? o.description ?? o.label ?? o.check;
    if (typeof cand === 'string' && cand.trim()) return cand.trim();
    if (typeof cand === 'number' && Number.isFinite(cand)) return String(cand);
  }
  return '';
}
