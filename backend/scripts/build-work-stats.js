import fs from 'node:fs';
import xlsx from 'xlsx';

function norm(s) {
  return String(s || '').trim().replace(/\s+/g, ' ');
}

function normKey(s) {
  return norm(s).toLowerCase();
}

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

function findHeaderRow(rows) {
  for (let i = 0; i < Math.min(rows.length, 50); i++) {
    const r = rows[i].map((x) => String(x || '').trim());
    if (r.includes('Наименование работы') && r.includes('Номер документа')) return i;
  }
  return -1;
}

function toIndex(header) {
  const m = new Map();
  header.forEach((h, i) => m.set(String(h).trim(), i));
  return m;
}

function parseCarMakeModel(carRaw) {
  const s = norm(carRaw);
  if (!s) return { make: '', model: '' };
  // Typical format: "Audi A8 Рег. номер: ...", "VAZ 2107 2004 г.", "Hyundai Solaris, 2016 г."
  const head = s.split(/рег\.\s*номер:|рег\.номер:|vin:|гос\.?номер:|номер:|,/i)[0].trim();
  const parts = head.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return { make: parts[0], model: '' };
  const make = parts[0];
  // Model: up to first year-like token or 3 tokens max
  const modelParts = [];
  for (let i = 1; i < parts.length; i++) {
    const p = parts[i];
    if (/^\d{4}$/.test(p)) break;
    if (/^\d{4}г\.?$/.test(p)) break;
    modelParts.push(p);
    if (modelParts.length >= 3) break;
  }
  return { make, model: modelParts.join(' ') };
}

const CATEGORIES = [
  { id: 'engine', title: 'Двигатель', kw: ['двиг', 'зажиган', 'свеч', 'катуш', 'форсунк', 'топлив', 'дроссел', 'лямбд', 'датчик', 'обд', 'компьютерн', 'check engine'] },
  { id: 'cooling', title: 'Охлаждение', kw: ['охлажд', 'антифриз', 'радиатор', 'термостат', 'помп', 'вентилятор', 'опресов', 'опрессов', 'перегрев'] },
  { id: 'brakes', title: 'Тормоза', kw: ['тормоз', 'колод', 'диск', 'суппорт', 'abs', 'тормозн'] },
  { id: 'suspension', title: 'Подвеска', kw: ['подвес', 'рычаг', 'шар', 'сайлент', 'стойк', 'аморт', 'стабилиз', 'шрус', 'привод', 'рулев', 'наконеч'] },
  { id: 'transmission', title: 'Трансмиссия', kw: ['акпп', 'мкпп', 'кпп', 'сцеплен', 'коробк', 'маховик', 'привод'] },
  { id: 'electric', title: 'Электрика', kw: ['аккум', 'генератор', 'стартер', 'провод', 'реле', 'предохран', 'электр', 'датчик'] },
  { id: 'ac', title: 'Кондиционер', kw: ['кондиц', 'компрессор', 'фреон', 'заправка кондицион'] },
];

function categorizeWork(workName) {
  const t = normKey(workName);
  let best = null;
  for (const c of CATEGORIES) {
    let score = 0;
    for (const k of c.kw) if (t.includes(k)) score++;
    if (!best || score > best.score) best = { score, c };
  }
  return best && best.score > 0 ? best.c.id : 'other';
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
    console.error('Header row not found (expected columns: "Номер документа", "Наименование работы").');
    process.exit(1);
  }

  const header = rows[headerRow];
  const idx = toIndex(header);
  const iDoc = idx.get('Номер документа');
  const iCar = idx.get('Автомобиль');
  const iWork = idx.get('Наименование работы');
  const iCost = idx.get('Стоимость работы');
  const iStart = idx.get('Дата начала');

  /** @type {Map<string, { docId:string, car:string, start:string, works:string[], costs:number[] }>} */
  const docs = new Map();
  const last = { doc: '', car: '', start: '' };

  /** @type {Map<string, number>} */
  const workCount = new Map();
  /** @type {Map<string, number[]>} */
  const workCosts = new Map();
  /** @type {Map<string, Map<string, number>>} */
  const topWorksByCategory = new Map();
  /** @type {Map<string, Map<string, Map<string, number>>>} */
  const topWorksByCategoryAndMake = new Map(); // cat -> make -> work -> count
  /** @type {Map<string, number>} */
  const pairCount = new Map(); // key "a|||b"

  for (let i = headerRow + 1; i < rows.length; i++) {
    const r = rows[i];
    const docRaw = norm(r[iDoc]);
    const carRaw = iCar != null ? norm(r[iCar]) : '';
    const startRaw = iStart != null ? norm(r[iStart]) : '';

    if (docRaw) last.doc = docRaw;
    if (carRaw) last.car = carRaw;
    if (startRaw) last.start = startRaw;

    const work = norm(r[iWork]);
    if (!work || normKey(work) === 'итого') continue;
    if (!last.doc) continue;

    const cost = iCost != null ? parseMoneyRu(r[iCost]) : null;

    const docId = last.doc;
    const d = docs.get(docId) || { docId, car: last.car, start: last.start, works: [], costs: [] };
    d.works.push(work);
    if (Number.isFinite(cost)) d.costs.push(cost);
    if (!d.car && last.car) d.car = last.car;
    if (!d.start && last.start) d.start = last.start;
    docs.set(docId, d);

    workCount.set(work, (workCount.get(work) || 0) + 1);
    if (Number.isFinite(cost)) {
      const arr = workCosts.get(work) || [];
      arr.push(cost);
      workCosts.set(work, arr);
    }
    const cat = categorizeWork(work);
    if (!topWorksByCategory.has(cat)) topWorksByCategory.set(cat, new Map());
    const m = topWorksByCategory.get(cat);
    m.set(work, (m.get(work) || 0) + 1);

    const { make } = parseCarMakeModel(last.car);
    if (make) {
      if (!topWorksByCategoryAndMake.has(cat)) topWorksByCategoryAndMake.set(cat, new Map());
      const mm = topWorksByCategoryAndMake.get(cat);
      const mk = make;
      if (!mm.has(mk)) mm.set(mk, new Map());
      const wm = mm.get(mk);
      wm.set(work, (wm.get(work) || 0) + 1);
    }
  }

  // Build co-occurrence (work bundles) per document
  for (const d of docs.values()) {
    const uniq = Array.from(new Set(d.works.map(norm))).filter(Boolean);
    uniq.sort((a, b) => a.localeCompare(b, 'ru'));
    for (let i = 0; i < uniq.length; i++) {
      for (let j = i + 1; j < uniq.length; j++) {
        const a = uniq[i];
        const b = uniq[j];
        const key = `${a}|||${b}`;
        pairCount.set(key, (pairCount.get(key) || 0) + 1);
      }
    }
  }

  function quant(sorted, q) {
    if (!sorted.length) return null;
    const pos = (sorted.length - 1) * q;
    const base = Math.floor(pos);
    const rest = pos - base;
    if (sorted[base + 1] === undefined) return sorted[base];
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }

  const workPrice = [];
  for (const [workName, costs] of workCosts.entries()) {
    costs.sort((a, b) => a - b);
    workPrice.push({
      workName,
      n: costs.length,
      p25: quant(costs, 0.25),
      p50: quant(costs, 0.5),
      p75: quant(costs, 0.75),
    });
  }
  workPrice.sort((a, b) => (b.n || 0) - (a.n || 0));

  const catsOut = {};
  for (const [cat, m] of topWorksByCategory.entries()) {
    const arr = Array.from(m.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 200)
      .map(([workName, count]) => ({ workName, count }));
    catsOut[cat] = arr;
  }

  const catsMakeOut = {};
  for (const [cat, makeMap] of topWorksByCategoryAndMake.entries()) {
    catsMakeOut[cat] = {};
    for (const [make, m] of makeMap.entries()) {
      catsMakeOut[cat][make] = Array.from(m.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 200)
        .map(([workName, count]) => ({ workName, count }));
    }
  }

  const bundleOut = Array.from(pairCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5000)
    .map(([key, count]) => {
      const [a, b] = key.split('|||');
      return { a, b, count };
    });

  const out = {
    source: { file: input, sheet: sheetName, rows: rows.length, docs: docs.size },
    builtAt: new Date().toISOString(),
    categories: CATEGORIES.map((c) => ({ id: c.id, title: c.title })),
    topWorksByCategory: catsOut,
    topWorksByCategoryAndMake: catsMakeOut,
    workPrice,
    bundles: bundleOut,
  };

  fs.mkdirSync('data', { recursive: true });
  fs.writeFileSync('data/work_stats.json', JSON.stringify(out, null, 2), 'utf8');
  console.log(`OK: data/work_stats.json (docs=${docs.size}, bundles=${bundleOut.length}, priced=${workPrice.length})`);
}

main();

