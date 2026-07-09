import { BellRing } from 'lucide-react';

export interface NotificationItem {
  id: string;
  title: string;
  description: string;
  createdAt?: string;
}

export function NotificationCenter({ items }: { items: NotificationItem[] }) {
  return (
    <section className="notification-center">
      <header>
        <h3>
          <BellRing size={16} /> Центр уведомлений
        </h3>
        <span>{items.length}</span>
      </header>
      {items.length === 0 ? (
        <p>Новых уведомлений нет.</p>
      ) : (
        <ul>
          {items.map((item) => (
            <li key={item.id}>
              <strong>{item.title}</strong>
              <p>{item.description}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
