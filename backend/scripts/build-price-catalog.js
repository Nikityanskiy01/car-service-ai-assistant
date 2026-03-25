import fs from 'node:fs';
import xlsx from 'xlsx';

function parseMoneyRu(s) {
  if (s == null) return null;
  const str = String(s)
    .replace(/\s+/g, '')
    .replace(/\u00a0/g, '')
    .replace(',', '.')
    .replace(/[^\d.]/g, '');
  if (!str) return null;
  const n = Number(str);
  return Number.isFinite(n) ? n : null;
}

function quantile(sorted, q) {
  if (!sorted.length) return null;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] === undefined) return sorted[base];
  return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
}

function normWorkName(s) {
  return String(s || '').trim().replace(/\s+/g, ' ');
}

function findHeaderRow(rows) {
  for (let i = 0; i < Math.min(rows.length, 50); i++) {
    const r = rows[i].map((x) => String(x || '').trim());
    if (r.includes('Наименование работы') && r.includes('Стоимость работы')) return i;
  }
  return -1;
}

function toIndex(header) {
  const m = new Map();
  header.forEach((h, i) => m.set(String(h).trim(), i));
  return m;
}

function main() {
  const input = 'data/service_history.xlsx';
  if (!fs.existsSync(input)) {
    console.error(`Input not found: ${input}`);
    process.exit(1);
  }

  const wb = xlsx.readFile(input, { cellDates: true });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rows = xlsx.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });
  const headerRow = findHeaderRow(rows);
  if (headerRow < 0) {
    console.error('Header row not found (expected columns: "Наименование работы", "Стоимость работы").');
    process.exit(1);
  }

  const header = rows[headerRow];
  const idx = toIndex(header);
  const iWork = idx.get('Наименование работы');
  const iCost = idx.get('Стоимость работы');
  const iCar = idx.get('Автомобиль');
  const iStart = idx.get('Дата начала');

  /** @type {Map<string, { costs:number[], cars:Set<string>, dates:Set<string> }>} */
  const byWork = new Map();
  for (let i = headerRow + 1; i < rows.length; i++) {
    const r = rows[i];
    const work = normWorkName(r[iWork]);
    if (!work || work.toLowerCase() === 'итого') continue;
    const cost = parseMoneyRu(r[iCost]);
    if (!Number.isFinite(cost) || cost <= 0) continue;
    const car = iCar != null ? String(r[iCar] || '').trim() : '';
    const date = iStart != null ? String(r[iStart] || '').trim() : '';

    const cur = byWork.get(work) || { costs: [], cars: new Set(), dates: new Set() };
    cur.costs.push(cost);
    if (car) cur.cars.add(car);
    if (date) cur.dates.add(date);
    byWork.set(work, cur);
  }

  const items = [];
  for (const [workName, v] of byWork.entries()) {
    v.costs.sort((a, b) => a - b);
    const p25 = quantile(v.costs, 0.25);
    const p50 = quantile(v.costs, 0.5);
    const p75 = quantile(v.costs, 0.75);
    items.push({
      workName,
      n: v.costs.length,
      p25,
      p50,
      p75,
      min: v.costs[0],
      max: v.costs[v.costs.length - 1],
      examples: Array.from(v.cars).slice(0, 5),
      dateRangeHint: Array.from(v.dates).slice(0, 2),
    });
  }

  items.sort((a, b) => b.n - a.n);
  const out = {
    source: { file: input, sheet: sheetName, rows: rows.length },
    builtAt: new Date().toISOString(),
    items,
  };

  fs.mkdirSync('data', { recursive: true });
  fs.writeFileSync('data/price_catalog.json', JSON.stringify(out, null, 2), 'utf8');
  console.log(`OK: data/price_catalog.json (${items.length} work names)`);
}

main();

