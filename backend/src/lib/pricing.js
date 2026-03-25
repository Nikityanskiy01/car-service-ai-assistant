import fs from 'node:fs';

function hasAny(text, needles) {
  const s = String(text || '').toLowerCase();
  return needles.some((n) => s.includes(n));
}

let catalogCache;

function getCatalog() {
  if (catalogCache !== undefined) return catalogCache;
  try {
    // Lazy-load optional generated catalog.
    // eslint-disable-next-line n/no-sync
    const raw = fs.readFileSync(new URL('../../data/price_catalog.json', import.meta.url), 'utf8');
    catalogCache = JSON.parse(raw);
  } catch {
    catalogCache = null;
  }
  return catalogCache;
}

function tokenizeRu(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-zа-я0-9]+/gi, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .filter((t) => t.length >= 3);
}

function tokenOverlapScore(a, b) {
  const ta = new Set(tokenizeRu(a));
  const tb = new Set(tokenizeRu(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let hit = 0;
  for (const t of ta) if (tb.has(t)) hit++;
  return hit / Math.max(ta.size, tb.size);
}

/**
 * Very simple deterministic price estimation so UX doesn't depend on LLM quality.
 * Returns minimal expected cost in rubles (minor).
 *
 * @param {{ symptoms?: string|null, problemConditions?: string|null }} ext
 * @param {{ recommendations?: Array<{ title?: string, probabilityPercent?: number }> }} ai
 */
export function estimateCostFromMinor(ext, ai = {}) {
  const symptoms = String(ext?.symptoms || '');
  const conditions = String(ext?.problemConditions || '');
  const recTitles = (ai.recommendations || []).map((r) => String(r?.title || '')).join(' | ');
  const text = `${symptoms} ${conditions} ${recTitles}`;

  // If we have a generated catalog, try to map recommendations to real work names.
  const catalog = getCatalog();
  if (catalog?.items?.length) {
    const targets = []
      .concat((ai.recommendations || []).map((r) => r?.title).filter(Boolean))
      .concat([symptoms]);
    let best = null;
    for (const t of targets) {
      for (const item of catalog.items) {
        const score = tokenOverlapScore(t, item.workName);
        if (!best || score > best.score) best = { score, item };
      }
    }
    if (best && best.score >= 0.34 && Number.isFinite(best.item.p25)) {
      return Math.round(best.item.p25);
    }
  }

  // Baseline: "комплексная диагностика"
  let cost = 3500;

  // Additive / overrides by signals
  if (hasAny(text, ['check engine', 'чек', 'ошибк', 'пропуск', 'троит', 'датчик', 'лямбда'])) {
    cost = Math.max(cost, 2500);
  }
  if (hasAny(text, ['стук', 'скрип', 'люфт', 'подвеск', 'рычаг', 'стойк', 'шрус', 'привод'])) {
    cost = Math.max(cost, 3000);
  }
  if (hasAny(text, ['тормоз', 'вибрац', 'биен', 'abs'])) {
    cost = Math.max(cost, 2800);
  }
  if (hasAny(text, ['теч', 'масл', 'антифриз', 'охлажд', 'перегрев'])) {
    cost = Math.max(cost, 3200);
  }

  return Math.round(cost);
}

