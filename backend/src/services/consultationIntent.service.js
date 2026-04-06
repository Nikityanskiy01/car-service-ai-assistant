/**
 * Определение намерения: плановое обслуживание vs диагностика неисправности.
 */

const DIAGNOSTIC_MARKERS = [
  'стук',
  'шум',
  'вибрация',
  'не заводится',
  'троит',
  'перегрев',
  'плавают обороты',
  'биение руля',
  'уводит в сторону',
  'check engine',
];

const SERVICE_MARKERS = [
  'замена масла',
  'поменять масло',
  'заменить масло',
  'замена фильтра',
  'замена колодок',
  'замена ремня',
  'шиномонтаж',
  'техническое обслуживание',
  'плановое обслуживание',
  'регламентное обслуживание',
];

/**
 * «ТО» как аббревиатура техобслуживания (не подстрока в «это», «что»).
 * @param {string} low
 */
function hasServiceToAbbrev(low) {
  const s = low.trim();
  if (s === 'то' || s === 'т.о.' || s === 'т.о') return true;
  return /(^|[\s,.;:!?])то($|[\s,.;:!?])/i.test(low);
}

/**
 * @param {string} message
 * @returns {'diagnostic'|'service'|'unknown'}
 */
export function detectConsultationIntent(message) {
  const low = String(message || '').toLowerCase();
  if (!low.trim()) return 'unknown';

  let hasDiagnostic = false;
  for (const m of DIAGNOSTIC_MARKERS) {
    if (low.includes(m)) hasDiagnostic = true;
  }

  let hasService = false;
  let longestService = '';
  for (const m of SERVICE_MARKERS) {
    if (low.includes(m)) {
      hasService = true;
      if (m.length > longestService.length) longestService = m;
    }
  }
  if (!hasService && hasServiceToAbbrev(low)) hasService = true;

  if (hasDiagnostic) return 'diagnostic';

  if (hasService) {
    const stripped = low.replace(longestService, '').replace(/[,.\s]+/g, ' ').trim();
    const filler = /^[\s\d]*(?:тыс(?:яч)?|км|год[а-я]*|пробег|мазда|mazda|bmw|toyota|kia|hyundai|honda|nissan|audi|vw|volkswagen|mercedes|лада|ваз|форд|шкода|рено|опель|пежо|субару|шевроле|чери|хавал|geely|haval|лексус|вольво|порше|фиат|ситроен|mitsubishi|suzuki|[a-zа-яё]{1,3}\d{1,4}|\d{4}\s*г(?:од)?)\b/gi;
    const remainder = stripped.replace(filler, '').replace(/\s+/g, ' ').trim();
    if (remainder.length > 12) return 'diagnostic';
    return 'service';
  }

  return 'unknown';
}

/**
 * @param {string} message
 * @returns {'oil_change'|'brake_pads'|'filters'|'timing_belt'|'maintenance'|'tire_service'|'unknown'}
 */
export function detectServiceType(message) {
  const low = String(message || '').toLowerCase();
  if (!low.trim()) return 'unknown';

  if (low.includes('масло') || low.includes('масла')) return 'oil_change';
  if (low.includes('колод')) return 'brake_pads';
  if (low.includes('фильтр')) return 'filters';
  if (low.includes('ремень') || low.includes('грм')) return 'timing_belt';
  if (low.includes('шиномонтаж')) return 'tire_service';
  if (
    hasServiceToAbbrev(low) ||
    low.includes('техобслуживание') ||
    low.includes('техническое обслуживание') ||
    low.includes('плановое обслуживание') ||
    low.includes('регламентное обслуживание')
  ) {
    return 'maintenance';
  }

  return 'unknown';
}

const SERVICE_RESULT_LABELS = {
  oil_change: 'замену масла',
  brake_pads: 'замену тормозных колодок',
  filters: 'замену фильтров',
  timing_belt: 'замену ремня ГРМ',
  maintenance: 'плановое техническое обслуживание',
  tire_service: 'шиномонтаж',
  unknown: 'запланированные работы',
};

/**
 * @param {string} serviceType
 */
export function serviceResultAssistantMessage(serviceType) {
  const label = SERVICE_RESULT_LABELS[serviceType] || SERVICE_RESULT_LABELS.unknown;
  return `Можно записать автомобиль на ${label}. Хотите оформить заявку?`;
}
