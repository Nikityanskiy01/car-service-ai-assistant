import { formatBookingCountdown } from './bookingCountdown';

export type BookingUiContext = {
  dateBadge: string | null;
  showPastChip: boolean;
  canManage: boolean;
  showCalendarPrimary: boolean;
  showCalendar: boolean;
  showBookAgain: boolean;
  showCallPrimary: boolean;
  headerHint: string | null;
};

function normalizeBookingStatus(status: string): string {
  return String(status || '').toUpperCase();
}

export function resolveBookingUiContext(
  preferredAt: string,
  status: string,
  now = Date.now(),
): BookingUiContext {
  const normalized = normalizeBookingStatus(status);
  const isCancelled = normalized === 'CANCELLED';
  const isPending = normalized === 'PENDING';
  const isConfirmed = normalized === 'CONFIRMED' || normalized === 'ARRIVED';
  const isMissed = normalized === 'NO_SHOW';
  const preferredMs = new Date(preferredAt).getTime();
  const isFuture = preferredMs > now;
  const countdown = formatBookingCountdown(preferredAt, now);

  if (isCancelled) {
    return {
      dateBadge: null,
      showPastChip: false,
      canManage: false,
      showCalendarPrimary: false,
      showCalendar: false,
      showBookAgain: true,
      showCallPrimary: false,
      headerHint: null,
    };
  }

  if (isPending) {
    return {
      dateBadge: isFuture ? countdown : 'Ждём подтверждения',
      showPastChip: false,
      canManage: true,
      showCalendarPrimary: false,
      showCalendar: isFuture,
      showBookAgain: false,
      showCallPrimary: !isFuture,
      headerHint: isFuture ? countdown : 'ожидает подтверждения',
    };
  }

  if (isMissed || !isFuture) {
    return {
      dateBadge: isFuture ? countdown : 'Прошло',
      showPastChip: !isFuture,
      canManage: false,
      showCalendarPrimary: false,
      showCalendar: false,
      showBookAgain: true,
      showCallPrimary: isMissed,
      headerHint: null,
    };
  }

  return {
    dateBadge: countdown,
    showPastChip: false,
    canManage: isConfirmed,
    showCalendarPrimary: isConfirmed,
    showCalendar: true,
    showBookAgain: false,
    showCallPrimary: false,
    headerHint: countdown,
  };
}
