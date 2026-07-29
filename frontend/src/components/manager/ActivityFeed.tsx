import { Link } from 'react-router-dom';
import type { ActivityItem } from '../../api/dashboard';
import { EmptyState } from '../ui/EmptyState';

type Props = {
  items: ActivityItem[];
};

const TYPE_LABELS: Record<ActivityItem['type'], string> = {
  REQUEST_CREATED: 'Заявка',
  MESSAGE_SENT: 'Сообщение',
  FEEDBACK_SAVED: 'Оценка ИИ',
  CONTACT_CONVERTED: 'Входящее',
  CRM_EXPORTED: 'CRM',
  CRM_FAILED: 'CRM ошибка',
};

export function ActivityFeed({ items }: Props) {
  if (!items.length) {
    return <EmptyState title="Пока нет событий" description="Активность появится по мере работы." />;
  }

  return (
    <ul className="activity-feed">
      {items.map((item) => (
        <li key={item.id} className={`activity-feed-item activity-${item.type.toLowerCase()}`}>
          <time dateTime={item.at}>{new Date(item.at).toLocaleString('ru-RU')}</time>
          <div className="activity-feed-body">
            <span className="activity-type">{TYPE_LABELS[item.type]}</span>
            {item.requestId ? (
              <Link to={`/dashboard/manager/requests/${item.requestId}`}>{item.title}</Link>
            ) : (
              <span>{item.title}</span>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
