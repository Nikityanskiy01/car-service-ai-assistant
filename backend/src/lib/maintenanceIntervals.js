/** Интервалы планового ТО. */

export const OIL_CHANGE = {
  km: 7500,
  months: 6,
  soonKm: 500,
  soonDays: 30,
};

export const SERVICE_RECORD_CATEGORIES = [
  'oil_change',
  'maintenance',
  'brakes',
  'filters',
  'tires',
  'other',
];

export const CATEGORY_TITLES = {
  oil_change: 'Замена масла ДВС',
  maintenance: 'Плановое ТО',
  brakes: 'Тормозная система',
  filters: 'Замена фильтров',
  tires: 'Шиномонтаж',
  other: 'Прочие работы',
};

/**
 * @param {string} text
 * @returns {string}
 */
export function inferCategoryFromText(text) {
  const low = String(text || '').toLowerCase();
  if (!low.trim()) return 'other';
  if (low.includes('масл')) return 'oil_change';
  if (low.includes('колод') || low.includes('тормоз')) return 'brakes';
  if (low.includes('фильтр')) return 'filters';
  if (low.includes('шин') || low.includes('шиномонтаж')) return 'tires';
  if (low.includes('то') || low.includes('техобслуж') || low.includes('обслуживан')) return 'maintenance';
  return 'other';
}

/**
 * @param {Date|string} performedAt
 * @param {number} [months]
 * @returns {Date}
 */
export function addMonths(performedAt, months = OIL_CHANGE.months) {
  const d = new Date(performedAt);
  const result = new Date(d);
  result.setMonth(result.getMonth() + months);
  return result;
}

/**
 * @param {{ performedAt: Date|string, mileageKm?: number|null, currentMileageKm?: number|null, now?: Date }} input
 */
export function computeOilChangeDue(input) {
  const now = input.now ? new Date(input.now) : new Date();
  const performedAt = new Date(input.performedAt);
  const nextDueAt = addMonths(performedAt, OIL_CHANGE.months);
  const mileageKm = input.mileageKm != null && Number.isFinite(Number(input.mileageKm))
    ? Math.round(Number(input.mileageKm))
    : null;
  const nextDueMileage = mileageKm != null ? mileageKm + OIL_CHANGE.km : null;
  const currentMileageKm =
    input.currentMileageKm != null && Number.isFinite(Number(input.currentMileageKm))
      ? Math.round(Number(input.currentMileageKm))
      : null;

  const daysLeft = Math.ceil((nextDueAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
  const kmLeft =
    nextDueMileage != null && currentMileageKm != null ? nextDueMileage - currentMileageKm : null;

  let status = 'ok';
  const overdueByDate = daysLeft < 0;
  const overdueByKm = kmLeft != null && kmLeft < 0;
  if (overdueByDate || overdueByKm) {
    status = 'overdue';
  } else if (
    daysLeft <= OIL_CHANGE.soonDays ||
    (kmLeft != null && kmLeft <= OIL_CHANGE.soonKm)
  ) {
    status = 'soon';
  }

  return {
    intervalKm: OIL_CHANGE.km,
    intervalMonths: OIL_CHANGE.months,
    lastPerformedAt: performedAt.toISOString(),
    lastMileageKm: mileageKm,
    nextDueAt: nextDueAt.toISOString(),
    nextDueMileage,
    daysLeft,
    kmLeft,
    status,
    currentMileageKm,
  };
}

/**
 * @param {Array<{ performedAt: Date|string, mileageKm?: number|null, category?: string, title?: string, worksDone?: string }>} records
 * @param {{ currentMileageKm?: number|null, now?: Date }} [opts]
 */
export function buildOilMaintenancePlan(records, opts = {}) {
  const oilRecords = (records || []).filter((r) => {
    if (r.category === 'oil_change') return true;
    const blob = `${r.title || ''} ${r.worksDone || ''}`.toLowerCase();
    return blob.includes('масл');
  });

  if (!oilRecords.length) {
    return {
      hasHistory: false,
      intervalKm: OIL_CHANGE.km,
      intervalMonths: OIL_CHANGE.months,
      status: 'unknown',
      message: 'Нет записей о замене масла',
      lastRecord: null,
      plan: null,
    };
  }

  const sorted = [...oilRecords].sort(
    (a, b) => new Date(b.performedAt).getTime() - new Date(a.performedAt).getTime(),
  );
  const last = sorted[0];
  const plan = computeOilChangeDue({
    performedAt: last.performedAt,
    mileageKm: last.mileageKm,
    currentMileageKm: opts.currentMileageKm,
    now: opts.now,
  });

  return {
    hasHistory: true,
    intervalKm: OIL_CHANGE.km,
    intervalMonths: OIL_CHANGE.months,
    status: plan.status,
    message: null,
    lastRecord: {
      performedAt: plan.lastPerformedAt,
      mileageKm: plan.lastMileageKm,
      title: last.title || CATEGORY_TITLES.oil_change,
    },
    plan,
  };
}
