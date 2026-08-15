import { api } from './client';

export type InboxNotification = {
  id: string;
  kind: string;
  title: string;
  body: string;
  href: string | null;
  readAt: string | null;
  createdAt: string;
};

export type InboxListResponse = {
  items: InboxNotification[];
  unreadCount: number;
};

export type NotificationChannelStatus = {
  enabled: boolean;
  available: boolean;
  soon?: boolean;
  linked?: boolean;
  botConfigured?: boolean;
  destination?: string | null;
  hint?: string;
  label?: string;
};

export type NotificationPreferences = {
  bookingReminders: boolean;
  messageAlerts: boolean;
  marketing: boolean;
  channelEmail: boolean;
  channelTelegram: boolean;
  channelSms: boolean;
  channels: {
    inApp: NotificationChannelStatus;
    email: NotificationChannelStatus;
    telegram: NotificationChannelStatus;
    sms: NotificationChannelStatus;
  };
};

export function listInboxNotifications(limit = 30) {
  return api<InboxListResponse>(`/users/me/notifications?limit=${limit}`);
}

export function getInboxUnreadCount() {
  return api<{ unreadCount: number }>('/users/me/notifications/unread-count');
}

export function markInboxRead(ids?: string[]) {
  return api<{ updated: number; unreadCount: number }>('/users/me/notifications/read', {
    method: 'POST',
    body: { ids },
  });
}

export function getNotificationPreferences() {
  return api<NotificationPreferences>('/users/me/notification-preferences');
}

export function patchNotificationPreferences(
  body: Partial<
    Pick<
      NotificationPreferences,
      'bookingReminders' | 'messageAlerts' | 'marketing' | 'channelEmail' | 'channelTelegram' | 'channelSms'
    >
  >,
) {
  return api<NotificationPreferences>('/users/me/notification-preferences', {
    method: 'PATCH',
    body,
  });
}
