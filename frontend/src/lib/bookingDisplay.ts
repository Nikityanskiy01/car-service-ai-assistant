import type { ServiceBooking } from '../types/dashboard';

export function getBookingVehicleLabel(booking: ServiceBooking): string | null {
  const sr = booking.serviceRequest;
  if (!sr) return null;
  const car = [sr.snapshotMake, sr.snapshotModel].filter(Boolean).join(' ');
  return car || null;
}

export function getBookingTitle(booking: ServiceBooking): string {
  const vehicle = getBookingVehicleLabel(booking);
  if (vehicle) return vehicle;
  if (booking.serviceName) return booking.serviceName;
  return 'Запись в сервис';
}

export function getBookingSubtitle(booking: ServiceBooking): string | null {
  const sr = booking.serviceRequest;
  if (sr?.snapshotSymptoms) return sr.snapshotSymptoms;
  const notes = booking.notes || booking.comment;
  return notes?.trim() || null;
}

export function formatBookingDateParts(value: string) {
  const date = new Date(value);
  return {
    weekday: date.toLocaleDateString('ru-RU', { weekday: 'long' }),
    day: date.toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' }),
    time: date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
    short: date.toLocaleString('ru-RU', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }),
  };
}

export function formatBookingRelative(value: string): string | null {
  const diffMs = new Date(value).getTime() - Date.now();
  const absMs = Math.abs(diffMs);
  const minutes = Math.round(absMs / 60000);
  if (minutes < 60) {
    return diffMs >= 0 ? 'скоро' : `${minutes} мин назад`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return diffMs >= 0 ? `через ${hours} ч` : `${hours} ч назад`;
  }
  const days = Math.round(hours / 24);
  if (days < 14) {
    return diffMs >= 0 ? `через ${days} дн` : `${days} дн назад`;
  }
  return null;
}
