const MSK_TZ = 'Europe/Moscow';

/**
 * Удобное время визита: 09:00–21:00 по Москве (21:00 уже нерабочее).
 * @param {Date | string | number} value
 */
export function isPreferredAtInMoscowBookingWindow(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return false;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: MSK_TZ,
    hour: 'numeric',
    hour12: false,
  }).formatToParts(d);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value);
  return Number.isFinite(hour) && hour >= 9 && hour < 21;
}
