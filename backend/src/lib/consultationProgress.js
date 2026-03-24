/**
 * Six mandatory fields: make, model, year, mileage, symptoms, problemConditions (FR-025a).
 * @param {import('@prisma/client').ExtractedDiagnosticData | null | undefined} ext
 */
export function isExtractedComplete(ext) {
  if (!ext) return false;
  const t = (s) => typeof s === 'string' && s.trim().length > 0;
  return (
    t(ext.make) &&
    t(ext.model) &&
    ext.year != null &&
    Number.isFinite(ext.year) &&
    ext.mileage != null &&
    Number.isFinite(ext.mileage) &&
    t(ext.symptoms) &&
    t(ext.problemConditions)
  );
}

/**
 * @param {import('@prisma/client').ExtractedDiagnosticData | null | undefined} ext
 */
export function progressFromExtracted(ext) {
  if (!ext) return 0;
  const t = (s) => typeof s === 'string' && s.trim().length > 0;
  let n = 0;
  if (t(ext.make)) n++;
  if (t(ext.model)) n++;
  if (ext.year != null && Number.isFinite(ext.year)) n++;
  if (ext.mileage != null && Number.isFinite(ext.mileage)) n++;
  if (t(ext.symptoms)) n++;
  if (t(ext.problemConditions)) n++;
  return Math.min(100, Math.round((n / 6) * 100));
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
