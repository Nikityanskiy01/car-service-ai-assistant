export function extractMileageRegex(t, base: any = {}) {
  const low = t.toLowerCase();
  const normalized = low.replace(/\s+/g, ' ').trim();
  const explicitUnknown = /(не\s+знаю|неизвест|без\s+пробега|пробег\s+не\s+указан)/i.test(normalized);
  if (explicitUnknown) return null;

  const hasMileageContext = /пробег|одометр|на\s+одометре|тыс/.test(normalized);
  const hasVehicleContext =
    Boolean(base?.car_make) ||
    Boolean(base?.car_model) ||
    /\b(skoda|toyota|kia|bmw|audi|vw|volkswagen|honda|hyundai|nissan|ford|лада|шкода|тойота)\b/i.test(t);

  const explicitMileageMatch =
    t.match(/(?:пробег|одометр|на\s+одометре)\D{0,20}(\d[\d\s]{1,7})\s*(тыс(?:\.|яч(?:а|и)?)?)?/i) ||
    t.match(/\b(\d{2,3})\s*тыс(?:\.|яч(?:а|и)?)\s*(?:км)?\b/i);
  if (explicitMileageMatch) {
    const raw = String(explicitMileageMatch[1]).replace(/\s+/g, '');
    const n = Number(raw);
    if (!Number.isFinite(n)) return null;
    const isThousands =
      /тыс/i.test(String(explicitMileageMatch[0])) || (/пробег/i.test(low) && n > 0 && n < 1000);
    return isThousands ? n * 1000 : n;
  }

  const kmMatch = t.match(/\b(\d{3,7})\s*км\b(?!\s*\/\s*ч)/i);
  if (!kmMatch) {
    const plainNumber = String(t || '').trim();
    if (/^\d{3,7}$/.test(plainNumber) && hasVehicleContext) {
      const n = Number(plainNumber);
      if (Number.isFinite(n) && (n < 1950 || n > 2035)) return n;
    }
    return null;
  }

  const n = Number(String(kmMatch[1]).replace(/\s+/g, ''));
  if (!Number.isFinite(n)) return null;
  if (!hasMileageContext && (n >= 1950 && n <= 2035)) return null;
  if (!hasMileageContext && !hasVehicleContext) {
    if (/после\s+ремонта|после\s+замены|проехал|поездк|маршрут/i.test(normalized)) return null;
  }
  return n;
}

export function extractYearRegex(t) {
  const matches = [...String(t || '').matchAll(/\b(19[7-9]\d|20[0-3]\d)\b/g)];
  for (const m of matches) {
    const year = Number(m[1]);
    const idx = m.index ?? -1;
    const left = String(t).slice(Math.max(0, idx - 20), idx).toLowerCase();
    const right = String(t).slice(idx + String(m[0]).length, idx + String(m[0]).length + 16).toLowerCase();
    const mileageContext = /пробег|одометр/.test(left) || /\s*км\b/.test(right);
    if (mileageContext) continue;
    return year;
  }
  return null;
}
