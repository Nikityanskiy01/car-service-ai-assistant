export type BookingTab = 'upcoming' | 'past' | 'cancelled';

export function parseBookingTab(value: string | null): BookingTab {
  if (value === 'past' || value === 'cancelled') return value;
  return 'upcoming';
}
