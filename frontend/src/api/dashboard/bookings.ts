import { api } from '../client';
import type { ServiceBooking } from '../../types/dashboard';

export function listBookings() {
  return api<ServiceBooking[]>('/bookings');
}

export function getBooking(bookingId: string) {
  return api<ServiceBooking>(`/bookings/${bookingId}`);
}

export function cancelBooking(bookingId: string) {
  return api<ServiceBooking>(`/bookings/${bookingId}`, {
    method: 'PATCH',
    body: { status: 'CANCELLED' },
  });
}

export function rescheduleBooking(bookingId: string, preferredAt: string) {
  return api<ServiceBooking>(`/bookings/${bookingId}`, {
    method: 'PATCH',
    body: { preferredAt },
  });
}

export function patchBooking(
  bookingId: string,
  body: {
    status?: 'PENDING' | 'CONFIRMED' | 'ARRIVED' | 'NO_SHOW' | 'CANCELLED';
    preferredAt?: string;
    notes?: string | null;
  },
) {
  return api<ServiceBooking>(`/bookings/${bookingId}`, { method: 'PATCH', body });
}

export type BookingAuditEntry = {
  id: string;
  createdAt: string;
  actor?: { id: string; fullName: string; email: string } | null;
  changes: Record<string, { from: unknown; to: unknown }>;
};

export function getBookingAudit(bookingId: string) {
  return api<BookingAuditEntry[]>(`/bookings/${bookingId}/audit`);
}
