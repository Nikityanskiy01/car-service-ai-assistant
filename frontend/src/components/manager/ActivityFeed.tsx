import { Link } from 'react-router-dom';
import type { ActivityItem } from '../../api/dashboard';
import { formatRelativeTime } from '../../lib/managerRequestHelpers';
import { EmptyState } from '../ui/EmptyState';

type Props = {
  items: ActivityItem[];
  requestBasePath?: string;
  compact?: boolean;
};

const TYPE_LABELS: Record<ActivityItem['type'], string> = {
  REQUEST_CREATED: 'Заявка',
  MESSAGE_SENT: 'Сообщение',
  FEEDBACK_SAVED: 'Оценка ИИ',
  CONTACT_CONVERTED: 'Входящее',
  CRM_EXPORTED: 'Учёт',
  CRM_FAILED: 'Не ушло в учёт',
};

export function ActivityFeed({
  items,
  requestBasePath = '/dashboard/manager/requests',
  compact = false,
}: Props) {
  if (!items.length) {
    return (
      <EmptyState
        title="Пока нет событий"
        description={compact ? undefined : 'Активность появится по мере работы.'}
      />
    );
  }

  return (
    <ul className={`activity-feed${compact ? ' is-compact' : ''}`}>
      {items.map((item) => (
        <li key={item.id} className={`activity-feed-item activity-${item.type.toLowerCase()}`}>
          <time dateTime={item.at} title={new Date(item.at).toLocaleString('ru-RU')} className="tnum">
            {formatRelativeTime(item.at)}
          </time>
          <div className="activity-feed-body">
            <span className="activity-type">{TYPE_LABELS[item.type]}</span>
            {item.requestId ? (
              <Link to={`${requestBasePath}/${item.requestId}`}>{item.title}</Link>
            ) : (
              <span>{item.title}</span>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
