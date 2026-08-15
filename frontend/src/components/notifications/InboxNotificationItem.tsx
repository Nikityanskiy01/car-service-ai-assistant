import { ChevronRight } from 'lucide-react';
import type { InboxNotification } from '../../api/notifications';
import {
  formatNotificationRelative,
  resolveNotificationVisual,
} from '../../features/notifications/notificationVisuals';

type Props = {
  item: InboxNotification;
  onOpen: (item: InboxNotification) => void;
  compact?: boolean;
};

export function InboxNotificationItem({ item, onOpen, compact = false }: Props) {
  const visual = resolveNotificationVisual(item.kind);
  const unread = !item.readAt;
  const Icon = visual.icon;
  const actionable = Boolean(item.href);

  return (
    <button
      type="button"
      className={`notification-item${unread ? ' is-unread' : ''}${compact ? ' is-compact' : ''}`}
      data-tone={visual.tone}
      onClick={() => onOpen(item)}
    >
      <span className="notification-item-icon" aria-hidden>
        <Icon size={compact ? 15 : 17} strokeWidth={1.75} />
      </span>
      <span className="notification-item-body">
        <span className="notification-item-top">
          <span className="notification-item-category">{visual.categoryLabel}</span>
          <time className="notification-item-time" dateTime={item.createdAt}>
            {formatNotificationRelative(item.createdAt)}
          </time>
        </span>
        <span className="notification-item-title">{item.title}</span>
        {!compact ? <span className="notification-item-text">{item.body}</span> : null}
        {actionable && visual.actionLabel ? (
          <span className="notification-item-action">{visual.actionLabel}</span>
        ) : null}
      </span>
      {unread ? <span className="notification-item-dot" aria-hidden /> : null}
      {actionable ? <ChevronRight className="notification-item-chevron" size={16} aria-hidden /> : null}
    </button>
  );
}
