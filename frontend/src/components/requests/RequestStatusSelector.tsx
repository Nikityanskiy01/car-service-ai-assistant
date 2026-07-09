import type { ServiceRequestStatus } from '../../types/serviceRequest';

const statuses: ServiceRequestStatus[] = ['NEW', 'IN_PROGRESS', 'SCHEDULED', 'COMPLETED', 'CANCELLED'];

export function RequestStatusSelector({
  value,
  onChange,
}: {
  value: ServiceRequestStatus;
  onChange: (value: ServiceRequestStatus) => void;
}) {
  return (
    <select
      className="select"
      aria-label="Изменить статус заявки"
      value={value}
      onChange={(event) => onChange(event.target.value as ServiceRequestStatus)}
    >
      {statuses.map((status) => (
        <option key={status} value={status}>
          {status}
        </option>
      ))}
    </select>
  );
}
