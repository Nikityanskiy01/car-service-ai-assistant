/**
 * Обязательные для завершения консультации и заявки: пробег, симптомы, условия.
 * Марка, модель и год желательны, но не блокируют результат.
 * @param {import('@prisma/client').ExtractedDiagnosticData | null | undefined} ext
 */
export function isExtractedComplete(ext) {
  if (!ext) return false;
  const t = (s) => typeof s === 'string' && s.trim().length > 0;
  return t(ext.symptoms) && (
    (ext.mileage != null && Number.isFinite(ext.mileage)) ||
    t(ext.make)
  );
}

/**
 * @param {import('@prisma/client').ExtractedDiagnosticData | null | undefined} ext
 */
export function progressFromExtracted(ext) {
  if (!ext) return 0;
  const t = (s) => typeof s === 'string' && s.trim().length > 0;
  let mandatory = 0;
  if (ext.mileage != null && Number.isFinite(ext.mileage)) mandatory++;
  if (t(ext.symptoms)) mandatory++;
  if (t(ext.problemConditions)) mandatory++;
  const mandatoryPct = (mandatory / 3) * 85;
  let opt = 0;
  if (t(ext.make)) opt++;
  if (t(ext.model)) opt++;
  if (ext.year != null && Number.isFinite(ext.year)) opt++;
  const optPct = (opt / 3) * 15;
  return Math.min(100, Math.round(mandatoryPct + optPct));
}

/**
 * Merge AI partial extraction into existing row (non-empty wins).
 * @param {Record<string, unknown>} partial
 */
export function mergeExtracted(existing, partial) {
  const out = { ...existing };
  const fields = ['make', 'model', 'year', 'mileage', 'symptoms', 'problemConditions'];
  for (const f of fields) {
    if (partial[f] === undefined || partial[f] === null) continue;
    if (f === 'year' || f === 'mileage') {
      const num = Number(partial[f]);
      if (Number.isFinite(num)) out[f] = num;
      continue;
    }
    const s = String(partial[f]).trim();
    if (s.length > 0) out[f] = s;
  }
  return out;
}
