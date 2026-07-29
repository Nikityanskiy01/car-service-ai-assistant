import { useState } from 'react';
import { Button } from '../ui/Button';
import { ManagerPicker } from './ManagerPicker';
import type { ServiceRequestStatus } from '../../types/serviceRequest';

type Props = {
  selectedCount: number;
  onAssign: (managerId?: string) => void;
  onStatusChange: (status: ServiceRequestStatus) => void;
  onExportCrm?: () => void;
  onClear: () => void;
  busy?: boolean;
};

const STATUS_OPTIONS: Array<{ value: ServiceRequestStatus; label: string }> = [
  { value: 'IN_PROGRESS', label: 'В работе' },
  { value: 'SCHEDULED', label: 'Запланирована' },
  { value: 'COMPLETED', label: 'Завершена' },
  { value: 'CANCELLED', label: 'Отменена' },
];

export function BulkActionBar({ selectedCount, onAssign, onStatusChange, onExportCrm, onClear, busy }: Props) {
  const [managerId, setManagerId] = useState('');

  if (selectedCount === 0) return null;

  return (
    <div className="bulk-action-bar" role="region" aria-label="Массовые действия">
      <span>Выбрано: {selectedCount}</span>
      <Button type="button" variant="secondary" disabled={busy} onClick={() => onAssign()}>
        Назначить на себя
      </Button>
      <ManagerPicker value={managerId} onChange={setManagerId} allowEmpty placeholder="Менеджер" />
      <Button
        type="button"
        variant="secondary"
        disabled={busy || !managerId}
        onClick={() => onAssign(managerId)}
      >
        Назначить выбранному
      </Button>
      {onExportCrm ? (
        <Button type="button" variant="secondary" disabled={busy} onClick={onExportCrm}>
          Экспорт в CRM
        </Button>
      ) : null}
      {STATUS_OPTIONS.map((opt) => (
        <Button
          key={opt.value}
          type="button"
          variant="ghost"
          disabled={busy}
          onClick={() => onStatusChange(opt.value)}
        >
          {opt.label}
        </Button>
      ))}
      <Button type="button" variant="ghost" disabled={busy} onClick={onClear}>
        Снять выбор
      </Button>
    </div>
  );
}
