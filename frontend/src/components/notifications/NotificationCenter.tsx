import { BellRing } from 'lucide-react';
import { InboxNotificationItem } from './InboxNotificationItem';
import type { InboxNotification } from '../../api/notifications';
import { groupNotificationsByDate } from '../../features/notifications/notificationVisuals';

export interface NotificationItem {
  id: string;
  title: string;
  description: string;
  createdAt?: string;
  kind?: string;
  href?: string | null;
  readAt?: string | null;
}

function toInboxItem(item: NotificationItem): InboxNotification {
  return {
    id: item.id,
    kind: item.kind || 'SYSTEM',
    title: item.title,
    body: item.description,
    href: item.href ?? null,
    readAt: item.readAt ?? null,
    createdAt: item.createdAt || new Date().toISOString(),
  };
}

export function NotificationCenter({
  items,
  onOpen,
}: {
  items: NotificationItem[];
  onOpen?: (item: NotificationItem) => void;
}) {
  const inboxItems = items.map(toInboxItem);
  const unread = inboxItems.filter((item) => !item.readAt).length;
  const groups = groupNotificationsByDate(inboxItems);

  return (
    <section className="notification-center">
      <header className="notification-center-head">
        <h3>
          <BellRing size={16} strokeWidth={1.75} aria-hidden />
          Центр уведомлений
        </h3>
        {unread > 0 ? <span className="notification-center-count">{unread}</span> : null}
      </header>

      {items.length === 0 ? (
        <div className="notification-empty is-inline">
          <p>Новых уведомлений нет</p>
          <span>Здесь появятся записи, ответы менеджера и напоминания.</span>
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.label} className="notification-group">
            <h4 className="notification-group-label">{group.label}</h4>
            <ul className="notification-list is-card">
              {group.items.map((item) => {
                const source = items.find((row) => row.id === item.id);
                return (
                  <li key={item.id}>
                    <InboxNotificationItem
                      item={item}
                      compact
                      onOpen={() => {
                        if (source && onOpen) onOpen(source);
                      }}
                    />
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </section>
  );
}
