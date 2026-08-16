import { AppError } from '../../../lib/errors.js';
import type { BookingStatus, ServiceRequestStatus } from '@prisma/client';

export const ACTIVE_STATUSES: ServiceRequestStatus[] = ['NEW', 'IN_PROGRESS', 'SCHEDULED'];
export const UPCOMING_BOOKING: BookingStatus[] = ['PENDING', 'CONFIRMED'];

export function assertStaff(user) {
  if (user.role !== 'MANAGER' && user.role !== 'ADMINISTRATOR') {
    throw new AppError(403, 'Недостаточно прав для выполнения действия.', 'FORBIDDEN');
  }
}

export function iso(value) {
  return value ? new Date(value).toISOString() : null;
}

function vehiclePreview(row) {
  return {
    make: row.make || null,
    model: row.model || null,
    year: row.year ?? null,
    licensePlate: row.licensePlate || null,
    vin: row.vin || null,
  };
}

export function pushUniqueVehicle(list, row) {
  const make = row.make || row.snapshotMake || '';
  const model = row.model || row.snapshotModel || '';
  if (!make && !model) return;
  const plate = (row.licensePlate || '').toLowerCase();
  const key = `${make}|${model}|${row.year || ''}|${plate}`.toLowerCase();
  if (list.some((item) => item._key === key)) return;
  list.push({ ...vehiclePreview({ ...row, make, model }), _key: key });
}

export function vehicleHaystack(vehicles) {
  return (vehicles || [])
    .map((item) => `${item.make || ''} ${item.model || ''} ${item.year || ''} ${item.licensePlate || ''} ${item.vin || ''}`)
    .join(' ');
}

export function stripVehicleKeys(vehicles) {
  return (vehicles || []).map(({ _key, ...rest }) => rest);
}

export function ltvBucket(session) {
  const request = session?.serviceRequest;
  if (request?.clientId) return `c:${request.clientId}`;
  if (session?.clientId) return `c:${session.clientId}`;
  if (request?.guestPhone) return `g:${request.guestPhone}`;
  if (session?.guestPhone) return `g:${session.guestPhone}`;
  return null;
}

export function nextBookingAt(bookings) {
  const now = Date.now();
  const upcoming = (bookings || [])
    .filter((row) => UPCOMING_BOOKING.includes(row.status) && new Date(row.preferredAt).getTime() >= now)
    .sort((a, b) => String(a.preferredAt).localeCompare(String(b.preferredAt)));
  return iso(upcoming[0]?.preferredAt);
}

export function snapshotVehiclesFromRequests(requests) {
  const list = [];
  for (const row of requests) pushUniqueVehicle(list, row);
  return stripVehicleKeys(list);
}
