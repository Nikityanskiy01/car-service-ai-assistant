import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, BellRing } from 'lucide-react';
import {
  getInboxUnreadCount,
  listInboxNotifications,
  markInboxRead,
  type InboxNotification,
} from '../../api/notifications';
import { groupNotificationsByDate } from '../../features/notifications/notificationVisuals';
import { useDashboardPolling } from '../../hooks/useDashboardPolling';
import { InboxNotificationItem } from './InboxNotificationItem';

export function InboxBell() {
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<InboxNotification[]>([]);
  const [loading, setLoading] = useState(false);

  const refreshCount = useCallback(async () => {
    try {
      const out = await getInboxUnreadCount();
      setUnread(out.unreadCount || 0);
    } catch {
      /* колокольчик не должен ломать кабинет */
    }
  }, []);

  const refreshList = useCallback(async () => {
    setLoading(true);
    try {
      const out = await listInboxNotifications(30);
      setItems(out.items);
      setUnread(out.unreadCount || 0);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshCount();
  }, [refreshCount]);

  useDashboardPolling(refreshCount, 45_000);

  useEffect(() => {
    if (open) void refreshList();
  }, [open, refreshList]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const first = panelRef.current?.querySelector<HTMLElement>('.notification-item');
    first?.focus();
  }, [open, items, loading]);

  async function openItem(item: InboxNotification) {
    setOpen(false);
    if (!item.readAt) {
      setItems((prev) =>
        prev.map((row) => (row.id === item.id ? { ...row, readAt: new Date().toISOString() } : row)),
      );
      setUnread((n) => Math.max(0, n - 1));
      void markInboxRead([item.id])
        .then((out) => setUnread(out.unreadCount))
        .catch(() => undefined);
    }
    if (item.href) navigate(item.href);
  }

  async function markAll() {
    const out = await markInboxRead();
    setUnread(out.unreadCount);
    setItems((prev) => prev.map((row) => ({ ...row, readAt: row.readAt || new Date().toISOString() })));
  }

  const groups = groupNotificationsByDate(items);

  return (
    <div className={`notification-shell${open ? ' is-open' : ''}`} ref={rootRef}>
      <button
        type="button"
        className={`notification-trigger${unread > 0 ? ' has-unread' : ''}`}
        aria-label={unread > 0 ? `Уведомления, непрочитанных: ${unread}` : 'Уведомления'}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
      >
        <Bell size={18} strokeWidth={1.75} />
        {unread > 0 ? <span className="notification-trigger-count">{unread > 9 ? '9+' : unread}</span> : null}
      </button>

      {open ? (
        <>
          <button type="button" className="notification-backdrop" aria-label="Закрыть уведомления" onClick={() => setOpen(false)} />
          <div className="notification-panel" ref={panelRef} role="dialog" aria-label="Уведомления">
            <header className="notification-panel-head">
              <div className="notification-panel-title">
                <BellRing size={17} aria-hidden />
                <strong>Уведомления</strong>
                {unread > 0 ? <span className="notification-panel-badge">{unread}</span> : null}
              </div>
              <div className="notification-panel-actions">
                {unread > 0 ? (
                  <button type="button" className="notification-panel-mark" onClick={() => void markAll()}>
                    Прочитать все
                  </button>
                ) : null}
                <button type="button" className="notification-panel-close" onClick={() => setOpen(false)}>
                  Закрыть
                </button>
              </div>
            </header>

            <div className="notification-panel-body">
              {loading && items.length === 0 ? (
                <div className="notification-empty">
                  <div className="notification-skeleton" />
                  <div className="notification-skeleton" />
                  <div className="notification-skeleton is-short" />
                </div>
              ) : items.length === 0 ? (
                <div className="notification-empty">
                  <span className="notification-empty-icon" aria-hidden>
                    <Bell size={22} strokeWidth={1.5} />
                  </span>
                  <p>Пока тихо</p>
                  <span>Напоминания о визите и ответы менеджера появятся здесь.</span>
                </div>
              ) : (
                groups.map((group) => (
                  <section key={group.label} className="notification-group">
                    <h3 className="notification-group-label">{group.label}</h3>
                    <ul className="notification-list">
                      {group.items.map((item) => (
                        <li key={item.id}>
                          <InboxNotificationItem item={item} onOpen={(row) => void openItem(row)} />
                        </li>
                      ))}
                    </ul>
                  </section>
                ))
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
