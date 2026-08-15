import { SERVICE_REQUEST_STATUS_LABELS } from '../../lib/labels';
import type { ServiceRequestStatus } from '../../types/serviceRequest';

const statuses: ServiceRequestStatus[] = ['NEW', 'IN_PROGRESS', 'SCHEDULED', 'COMPLETED', 'CANCELLED'];

export function RequestStatusSelector({
  value,
  onChange,
  disabled,
}: {
  value: ServiceRequestStatus;
  onChange: (value: ServiceRequestStatus) => void;
  disabled?: boolean;
}) {
  return (
    <select
      className={`select status-select status-select-${value.toLowerCase().replace(/_/g, '-')}`}
      aria-label="Изменить статус заявки"
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value as ServiceRequestStatus)}
      onClick={(event) => event.stopPropagation()}
    >
      {statuses.map((status) => (
        <option key={status} value={status}>
          {SERVICE_REQUEST_STATUS_LABELS[status]}
        </option>
      ))}
    </select>
  );
}
