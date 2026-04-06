const MSK_TZ = 'Europe/Moscow';

/**
 * @param {Date | string | number} date
 * @returns {{ hour: number; minute: number } | null}
 */
export function getWallClockInTimeZone(date, timeZone = MSK_TZ) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(d);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return { hour, minute };
}

/**
 * Запись только в интервале 09:00–21:00 по Москве (21:00 уже вне графика).
 * @param {Date | string | number} date
 * @returns {{ ok: true } | { ok: false; message: string }}
 */
export function assertPreferredAtInBookingWindow(date) {
  const wall = getWallClockInTimeZone(date, MSK_TZ);
  if (!wall) return { ok: false, message: 'Некорректная дата и время' };
  const { hour } = wall;
  if (hour >= 9 && hour < 21) return { ok: true };
  return {
    ok: false,
    message: 'Запись доступна с 9:00 до 21:00 по московскому времени',
  };
}
