import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Phone } from 'lucide-react';
import { patchServiceRequestStatus } from '../../api/dashboard';
import { UrgencyBadge } from '../consultation/UrgencyBadge';
import type { AttentionItem } from '../../lib/managerRequestHelpers';
import { EmptyState } from '../ui/EmptyState';
import { Button } from '../ui/Button';
import { CopyPhoneButton } from '../ui/CopyPhoneButton';
import { useToast } from '../ui/toastContext';

type Props = {
  items: AttentionItem[];
  onOpenBooking?: (bookingId: string) => void;
  onStatusChanged?: () => void;
};

export function PriorityQueueList({ items, onOpenBooking, onStatusChanged }: Props) {
  const { success, error: toastError } = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);

  if (!items.length) {
    return <EmptyState title="Всё под контролем" description="Срочных действий сейчас нет." />;
  }

  async function takeToWork(item: AttentionItem) {
    if (!item.requestId || item.version == null) return;
    setBusyId(item.id);
    try {
      await patchServiceRequestStatus(item.requestId, 'IN_PROGRESS', item.version);
      success('Заявка в работе', { description: item.title });
      onStatusChanged?.();
    } catch (e) {
      toastError(e instanceof Error ? e.message : 'Не удалось взять заявку в работу');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <ul className="priority-queue-list">
      {items.map((item) => {
        const canTake = item.requestId && item.version != null && item.status === 'NEW';
        const busy = busyId === item.id;
        return (
          <li key={item.id} className={`priority-queue-item${busy ? ' is-busy' : ''}`}>
            <div className="priority-queue-body">
              <div className="priority-queue-title-row">
                {item.urgency ? <UrgencyBadge urgency={item.urgency} /> : null}
                {item.isGuest ? <span className="guest-tag">гость</span> : null}
                {!item.isGuest && item.requestId ? (
                  <span className="guest-tag registered-tag">клиент</span>
                ) : null}
                <strong>{item.title}</strong>
              </div>
              <p className="priority-queue-reason">{item.reason}</p>
              {item.meta ? <p className="priority-queue-meta muted">{item.meta}</p> : null}
            </div>
            <div className="priority-queue-actions">
              {item.phone ? (
                <>
                  <a href={`tel:${item.phone}`} className="btn btn-ghost btn-icon" aria-label="Позвонить">
                    <Phone size={16} aria-hidden />
                  </a>
                  <CopyPhoneButton phone={item.phone} label="" />
                </>
              ) : null}
              {canTake ? (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => void takeToWork(item)}
                  title="Перевести заявку в статус «В работе»"
                >
                  В работу
                </Button>
              ) : null}
              {item.bookingId && onOpenBooking ? (
                <Button type="button" variant="secondary" onClick={() => onOpenBooking(item.bookingId!)}>
                  Запись
                </Button>
              ) : (
                <Link to={item.to} className="btn btn-secondary">
                  Открыть
                </Link>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
