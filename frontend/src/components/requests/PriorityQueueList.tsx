import { Link } from 'react-router-dom';
import { Phone } from 'lucide-react';
import { patchServiceRequestStatus } from '../../api/dashboard';
import { UrgencyBadge } from '../consultation/UrgencyBadge';
import type { AttentionItem } from '../../lib/managerRequestHelpers';
import type { ServiceRequestStatus } from '../../types/serviceRequest';
import { EmptyState } from '../ui/EmptyState';
import { Button } from '../ui/Button';

type Props = {
  items: AttentionItem[];
  onOpenBooking?: (bookingId: string) => void;
  onStatusChanged?: () => void;
};

export function PriorityQueueList({ items, onOpenBooking, onStatusChanged }: Props) {
  if (!items.length) {
    return <EmptyState title="Всё под контролем" description="Срочных действий сейчас нет." />;
  }

  async function quickStatus(requestId: string, version: number, status: ServiceRequestStatus) {
    await patchServiceRequestStatus(requestId, status, version);
    onStatusChanged?.();
  }

  return (
    <ul className="priority-queue-list">
      {items.map((item) => (
        <li key={item.id} className="priority-queue-item">
          <div className="priority-queue-body">
            <div className="priority-queue-title-row">
              {item.urgency ? <UrgencyBadge urgency={item.urgency} /> : null}
              {item.isGuest ? <span className="guest-tag">гость</span> : null}
              {!item.isGuest && item.requestId ? <span className="guest-tag registered-tag">клиент</span> : null}
              <strong>{item.title}</strong>
            </div>
            <p className="priority-queue-reason">{item.reason}</p>
            {item.meta ? <p className="priority-queue-meta muted">{item.meta}</p> : null}
          </div>
          <div className="priority-queue-actions">
            {item.phone ? (
              <a href={`tel:${item.phone}`} className="btn btn-ghost btn-icon" aria-label="Позвонить">
                <Phone size={16} />
              </a>
            ) : null}
            {item.requestId && item.version != null ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() =>
                  void quickStatus(item.requestId!, item.version!, 'IN_PROGRESS').catch(() => undefined)
                }
                title="Быстро взять в работу"
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
      ))}
    </ul>
  );
}
