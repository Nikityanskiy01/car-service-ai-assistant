import type { ServiceRequestStatus } from '../types/serviceRequest';
import { CLIENT_BOOKING_STATUS_LEGEND } from './clientStatusLegend';

export const CLIENT_REQUEST_STATUS_LABELS: Record<ServiceRequestStatus, string> = {
  NEW: 'Ждёт менеджера',
  IN_PROGRESS: 'В работе у сервиса',
  SCHEDULED: 'Запись назначена',
  COMPLETED: 'Работы завершены',
  CANCELLED: 'Закрыто',
};

export const CLIENT_BOOKING_STATUS_LABELS = Object.fromEntries(
  CLIENT_BOOKING_STATUS_LEGEND.map((item) => [item.status, item.label]),
);

export {
  CLIENT_BOOKING_STATUS_LEGEND,
  CLIENT_CALENDAR_FILE_HINT,
  CLIENT_REQUEST_STATUS_LEGEND,
} from './clientStatusLegend';

export function clientRequestStatusLabel(status: ServiceRequestStatus | string): string {
  return CLIENT_REQUEST_STATUS_LABELS[status as ServiceRequestStatus] || status;
}

export function clientBookingStatusLabel(status: string): string {
  return CLIENT_BOOKING_STATUS_LABELS[status] || status;
}

export function clientBookingStatusDescription(status: string): string {
  const item = CLIENT_BOOKING_STATUS_LEGEND.find((row) => row.status === status);
  return item?.description || clientBookingStatusLabel(status);
}
