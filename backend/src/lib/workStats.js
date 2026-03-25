import fs from 'node:fs';

let cache;

export function getWorkStats() {
  if (cache !== undefined) return cache;
  try {
    // eslint-disable-next-line n/no-sync
    const raw = fs.readFileSync(new URL('../../data/work_stats.json', import.meta.url), 'utf8');
    cache = JSON.parse(raw);
  } catch {
    cache = null;
  }
  return cache;
}

export function topWorksForCategory(categoryId, limit = 8) {
  const st = getWorkStats();
  const arr = st?.topWorksByCategory?.[categoryId];
  if (!Array.isArray(arr)) return [];
  return arr.slice(0, limit).map((x) => x.workName).filter(Boolean);
}

export function topWorksForCategoryAndMake(categoryId, make, limit = 8) {
  const st = getWorkStats();
  const byMake = st?.topWorksByCategoryAndMake?.[categoryId];
  const arr = byMake?.[String(make || '').trim()];
  if (!Array.isArray(arr)) return [];
  return arr.slice(0, limit).map((x) => x.workName).filter(Boolean);
}

