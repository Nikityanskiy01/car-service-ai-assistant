export type VisitConfirmLevel = 'none' | 'requested' | 'confirmed' | 'arrived' | 'missed' | 'cancelled';

export function resolveVisitConfirmLevel(bookingStatus?: string | null): VisitConfirmLevel {
  switch (String(bookingStatus || '').toUpperCase()) {
    case 'CONFIRMED':
      return 'confirmed';
    case 'ARRIVED':
      return 'arrived';
    case 'NO_SHOW':
      return 'missed';
    case 'CANCELLED':
      return 'cancelled';
    case 'PENDING':
      return 'requested';
    default:
      return 'none';
  }
}

export function isVisitConfirmed(bookingStatus?: string | null): boolean {
  const level = resolveVisitConfirmLevel(bookingStatus);
  return level === 'confirmed' || level === 'arrived';
}

/** Короткая подпись для тизера / таймлайна */
export function visitStatusHeadline(
  bookingStatus?: string | null,
  preferredAtLabel?: string | null,
): string {
  const level = resolveVisitConfirmLevel(bookingStatus);
  const when = preferredAtLabel?.trim();

  switch (level) {
    case 'confirmed':
    case 'arrived':
      return when ? `Запись подтверждена · ${when}` : 'Запись подтверждена';
    case 'requested':
      return when ? `Нужно согласовать · ${when}` : 'Нужно согласовать';
    case 'missed':
      return 'Запись пропущена';
    case 'cancelled':
      return 'Запись отменена';
    default:
      return when ? `Запись · ${when}` : 'Запись';
  }
}

export function visitTimelineDetail(
  bookingStatus?: string | null,
  preferredAtLabel?: string | null,
): string {
  const level = resolveVisitConfirmLevel(bookingStatus);
  const when = preferredAtLabel?.trim();

  switch (level) {
    case 'confirmed':
    case 'arrived':
      return when ? `Подтверждён на ${when}` : 'Подтверждён сервисом';
    case 'requested':
      return when
        ? `Предложен на ${when} — сначала согласуйте, потом подтвердим`
        : 'Предложен — сначала согласуйте, потом подтвердим';
    case 'missed':
      return 'Не приехали';
    case 'cancelled':
      return 'Отменён';
    default:
      return when ? `На ${when}` : 'Ещё не назначен';
  }
}
