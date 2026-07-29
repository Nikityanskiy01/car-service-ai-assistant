import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { Card } from '../ui/Card';

export type ActionInboxItem = {
  id: string;
  priority: 'P0' | 'P1' | 'P2';
  text: string;
  to: string;
};

const priorityLabels: Record<ActionInboxItem['priority'], string> = {
  P0: 'Критично',
  P1: 'Важно',
  P2: 'Внимание',
};

export function ActionInbox({ items }: { items: ActionInboxItem[] }) {
  if (!items.length) return null;

  const sorted = [...items].sort((a, b) => a.priority.localeCompare(b.priority));

  return (
    <Card className="action-inbox">
      <div className="card-section-header">
        <h2>
          <AlertTriangle size={18} aria-hidden /> Требует внимания
        </h2>
        <span className="muted-text">{sorted.length}</span>
      </div>
      <ul className="action-inbox-list">
        {sorted.map((item) => (
          <li key={item.id} className={`action-inbox-item priority-${item.priority.toLowerCase()}`}>
            <span className={`action-inbox-priority priority-${item.priority.toLowerCase()}`}>
              {priorityLabels[item.priority]}
            </span>
            <Link to={item.to} className="action-inbox-link">
              <strong>{item.text}</strong>
              <span>Открыть</span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
