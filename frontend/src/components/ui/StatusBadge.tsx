import { SERVICE_REQUEST_STATUS_LABELS } from '../../lib/labels';
import type { ServiceRequestStatus } from '../../types/serviceRequest';

const GENERIC_LABELS: Record<string, string> = {
  PENDING: 'Ожидает',
  CONFIRMED: 'Подтверждена',
  ARRIVED: 'Приехал',
  NO_SHOW: 'Не приехал',
  CANCELLED: 'Отменена',
  COMPLETED: 'Завершена',
};

export function StatusBadge({ status }: { status: string }) {
  const label =
    SERVICE_REQUEST_STATUS_LABELS[status as ServiceRequestStatus] ||
    GENERIC_LABELS[status] ||
    status;
  const className = `status-badge status-${String(status).toLowerCase().replace(/_/g, '-')}`;
  return <span className={className}>{label}</span>;
}
