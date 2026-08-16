import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '../ui/Button';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { ManagerPicker } from './ManagerPicker';
import { SERVICE_REQUEST_STATUS_LABELS } from '../../lib/labels';
import type { ServiceRequestStatus } from '../../types/serviceRequest';

type Props = {
  selectedCount: number;
  onAssign: (managerId?: string) => void;
  onStatusChange: (status: ServiceRequestStatus) => void;
  onExportCrm?: () => void;
  onClear: () => void;
  busy?: boolean;
};

const STATUS_OPTIONS: ServiceRequestStatus[] = ['IN_PROGRESS', 'SCHEDULED', 'COMPLETED'];
const DESTRUCTIVE_STATUS: ServiceRequestStatus = 'CANCELLED';

export function BulkActionBar({
  selectedCount,
  onAssign,
  onStatusChange,
  onExportCrm,
  onClear,
  busy,
}: Props) {
  const [managerId, setManagerId] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);

  useEffect(() => {
    if (!selectedCount) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClear();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedCount, onClear]);

  if (selectedCount === 0) return null;

  return (
    <>
      <div className="bulk-action-bar" role="region" aria-label="Массовые действия">
        <span className="bulk-action-count">Выбрано: {selectedCount}</span>

        <div className="bulk-action-group">
          <Button type="button" variant="secondary" disabled={busy} onClick={() => onAssign()}>
            Взять на себя
          </Button>
          <ManagerPicker value={managerId} onChange={setManagerId} allowEmpty placeholder="Другой менеджер" />
          <Button type="button" variant="secondary" disabled={busy || !managerId} onClick={() => onAssign(managerId)}>
            Назначить
          </Button>
        </div>

        <div className="bulk-action-group">
          {STATUS_OPTIONS.map((status) => (
            <Button key={status} type="button" variant="ghost" disabled={busy} onClick={() => onStatusChange(status)}>
              {SERVICE_REQUEST_STATUS_LABELS[status]}
            </Button>
          ))}
          <Button type="button" variant="ghost" disabled={busy} onClick={() => setConfirmCancel(true)}>
            {SERVICE_REQUEST_STATUS_LABELS[DESTRUCTIVE_STATUS]}
          </Button>
        </div>

        {onExportCrm ? (
          <Button type="button" variant="ghost" disabled={busy} onClick={onExportCrm}>
            В учётную систему
          </Button>
        ) : null}

        <button
          type="button"
          className="bulk-action-clear"
          disabled={busy}
          onClick={onClear}
          aria-label="Снять выбор (Esc)"
          title="Снять выбор (Esc)"
        >
          <X size={16} />
        </button>
      </div>

      <ConfirmDialog
        open={confirmCancel}
        title="Отменить заявки"
        text={`Отменить ${selectedCount} ${plural(selectedCount)}? Клиенты больше не смогут писать в переписку по ним.`}
        confirmLabel="Отменить заявки"
        onCancel={() => setConfirmCancel(false)}
        onConfirm={() => {
          setConfirmCancel(false);
          onStatusChange(DESTRUCTIVE_STATUS);
        }}
      />
    </>
  );
}

function plural(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'заявку';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'заявки';
  return 'заявок';
}
