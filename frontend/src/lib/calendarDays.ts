export function startOfLocalDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function addDays(date: Date, amount: number): Date {
  const next = startOfLocalDay(date);
  next.setDate(next.getDate() + amount);
  return next;
}

export function isoDay(date: Date): string {
  const local = startOfLocalDay(date);
  const year = local.getFullYear();
  const month = String(local.getMonth() + 1).padStart(2, '0');
  const day = String(local.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function daysInRange(start: Date, count: number): Date[] {
  const origin = startOfLocalDay(start);
  return Array.from({ length: count }, (_, index) => addDays(origin, index));
}

function monthName(date: Date, locale: string) {
  const part = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long' })
    .formatToParts(date)
    .find((item) => item.type === 'month');
  return part?.value || date.toLocaleDateString(locale, { month: 'long' });
}

export function formatRangeLabel(start: Date, count: number, locale = 'ru-RU'): string {
  const from = startOfLocalDay(start);
  if (count <= 1) {
    const label = from.toLocaleDateString(locale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
    return label.charAt(0).toUpperCase() + label.slice(1);
  }

  const to = addDays(from, count - 1);
  const fromDay = from.getDate();
  const toDay = to.getDate();
  const fromMonth = monthName(from, locale);
  const toMonth = monthName(to, locale);

  if (from.getMonth() === to.getMonth() && from.getFullYear() === to.getFullYear()) {
    return `${fromDay}-${toDay} ${fromMonth}`;
  }

  return `${fromDay} ${fromMonth} - ${toDay} ${toMonth}`;
}

export function isSameLocalDay(a: Date, b: Date): boolean {
  return isoDay(a) === isoDay(b);
}
