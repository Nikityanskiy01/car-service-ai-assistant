import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Phone } from 'lucide-react';
import { toast } from 'sonner';
import { patchServiceRequestStatus } from '../../api/dashboard';
import type { AttentionItem } from '../../lib/managerRequestHelpers';
import { CopyPhoneButton } from '../ui/CopyPhoneButton';
import { EmptyState } from '../ui/EmptyState';
import { Button } from '../ui/Button';

type Props = {
  items: AttentionItem[];
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  onOpenBooking?: (bookingId: string) => void;
  onStatusChanged?: () => void;
};

export function PriorityQueueList({
  items,
  emptyTitle = 'Очередь пуста',
  emptyDescription = 'Срочных действий сейчас нет.',
  emptyAction,
  onOpenBooking,
  onStatusChanged,
}: Props) {
  const [busyId, setBusyId] = useState<string | null>(null);

  if (!items.length) {
    return <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />;
  }

  async function takeToWork(item: AttentionItem) {
    if (!item.requestId || item.version == null) return;
    setBusyId(item.id);
    try {
      await patchServiceRequestStatus(item.requestId, 'IN_PROGRESS', item.version);
      toast.success('Заявка в работе', { description: item.title });
      onStatusChanged?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Не удалось взять заявку в работу');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <ul className="priority-queue-list">
      {items.map((item) => {
        const canTake = item.requestId && item.version != null && item.status === 'NEW';
        const busy = busyId === item.id;
        const showUrgency = item.urgency && (item.kind === 'sla' || item.kind === 'request' || item.kind === 'stale');
        return (
          <li
            key={item.id}
            className={`priority-queue-item kind-${item.kind}${busy ? ' is-busy' : ''}`}
          >
            <div>
              <div className="priority-queue-title-row">
                {showUrgency ? <span className="sla-badge">{item.urgency}</span> : null}
                {item.isGuest ? <span className="muted">гость</span> : null}
                {!item.isGuest && item.requestId ? <span className="muted">клиент</span> : null}
                <strong>{item.title}</strong>
              </div>
              <p className="priority-queue-reason">{item.reason}</p>
              {item.meta ? <p className="priority-queue-meta muted">{item.meta}</p> : null}
            </div>
            <div className="priority-queue-actions">
              {item.phone ? (
                <>
                  <a className="btn btn-ghost btn-icon" href={`tel:${item.phone}`} aria-label="Позвонить">
                    <Phone size={16} />
                  </a>
                  <CopyPhoneButton phone={item.phone} label="" />
                </>
              ) : null}
              {canTake ? (
                <Button type="button" disabled={busy} onClick={() => void takeToWork(item)}>
                  В работу
                </Button>
              ) : null}
              {item.bookingId && onOpenBooking ? (
                <Button type="button" variant="secondary" onClick={() => onOpenBooking(item.bookingId!)}>
                  Запись
                </Button>
              ) : (
                <Link className="btn btn-secondary" to={item.to}>
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
