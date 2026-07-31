export function getDaysUntilBooking(preferredAt: string, now = Date.now()): number {
  const booking = new Date(preferredAt);
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfBooking = new Date(booking);
  startOfBooking.setHours(0, 0, 0, 0);
  return Math.round((startOfBooking.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24));
}

export function formatBookingCountdown(preferredAt: string, now = Date.now()): string | null {
  const days = getDaysUntilBooking(preferredAt, now);
  if (days < 0) return 'Прошло';
  if (days === 0) return 'Сегодня';
  if (days === 1) return 'Завтра';
  if (days <= 7) return `Через ${days} дн.`;
  return null;
}

export function formatBookingDayParts(preferredAt: string) {
  const date = new Date(preferredAt);
  return {
    weekday: date.toLocaleString('ru-RU', { weekday: 'long' }),
    day: date.toLocaleString('ru-RU', { day: '2-digit' }),
    month: date.toLocaleString('ru-RU', { month: 'long' }),
    time: date.toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
  };
}
