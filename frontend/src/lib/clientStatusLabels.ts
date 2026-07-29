import type { ServiceRequestStatus } from '../types/serviceRequest';

export const CLIENT_REQUEST_STATUS_LABELS: Record<ServiceRequestStatus, string> = {
  NEW: 'Принята, ждёт менеджера',
  IN_PROGRESS: 'В работе у мастера',
  SCHEDULED: 'Запись назначена',
  COMPLETED: 'Ремонт завершён',
  CANCELLED: 'Отменена',
};

export const CLIENT_BOOKING_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Ожидает подтверждения',
  CONFIRMED: 'Подтверждена',
  CANCELLED: 'Отменена',
};

export function clientRequestStatusLabel(status: ServiceRequestStatus | string): string {
  return CLIENT_REQUEST_STATUS_LABELS[status as ServiceRequestStatus] || status;
}

export function clientBookingStatusLabel(status: string): string {
  return CLIENT_BOOKING_STATUS_LABELS[status] || status;
}
