import type { LucideIcon } from 'lucide-react';
import {
  Bell,
  CalendarClock,
  CalendarX2,
  CheckCircle2,
  FileText,
  MessageSquare,
  Megaphone,
  Sparkles,
} from 'lucide-react';

export type NotificationTone = 'booking' | 'message' | 'marketing' | 'system';

export type NotificationVisual = {
  tone: NotificationTone;
  icon: LucideIcon;
  categoryLabel: string;
  actionLabel: string | null;
};

const BOOKING_DEFAULT: NotificationVisual = {
  tone: 'booking',
  icon: CalendarClock,
  categoryLabel: 'Запись',
  actionLabel: 'Открыть записи',
};

const MESSAGE_DEFAULT: NotificationVisual = {
  tone: 'message',
  icon: MessageSquare,
  categoryLabel: 'Сообщение',
  actionLabel: 'Открыть переписку',
};

const MARKETING_DEFAULT: NotificationVisual = {
  tone: 'marketing',
  icon: Megaphone,
  categoryLabel: 'Акция',
  actionLabel: null,
};

const SYSTEM_DEFAULT: NotificationVisual = {
  tone: 'system',
  icon: Bell,
  categoryLabel: 'Уведомление',
  actionLabel: null,
};

const KIND_MAP: Record<string, Partial<NotificationVisual>> = {
  BOOKING_CREATED: { icon: Sparkles, categoryLabel: 'Новая запись', actionLabel: 'Смотреть записи' },
  BOOKING_CONFIRMED: { icon: CheckCircle2, categoryLabel: 'Подтверждение', actionLabel: 'Детали записи' },
  BOOKING_CANCELLED: { icon: CalendarX2, categoryLabel: 'Отмена', actionLabel: 'Детали записи' },
  BOOKING_RESCHEDULED: { categoryLabel: 'Перенос', actionLabel: 'Детали записи' },
  BOOKING_REMINDER_DAY: { categoryLabel: 'Напоминание', actionLabel: 'Детали записи' },
  BOOKING_REMINDER_HOUR: { categoryLabel: 'Скоро визит', actionLabel: 'Детали записи' },
  MANAGER_MESSAGE: MESSAGE_DEFAULT,
  MARKETING: MARKETING_DEFAULT,
  COMPLETION_DOCUMENTS: {
    tone: 'system',
    icon: FileText,
    categoryLabel: 'Документы',
    actionLabel: 'Открыть обращение',
  },
};

export function resolveNotificationVisual(kind: string): NotificationVisual {
  const key = String(kind || '').trim();
  if (key.startsWith('BOOKING_')) {
    return { ...BOOKING_DEFAULT, ...KIND_MAP[key] };
  }
  if (key === 'MANAGER_MESSAGE') return { ...MESSAGE_DEFAULT };
  if (key === 'MARKETING') return { ...MARKETING_DEFAULT };
  if (key === 'COMPLETION_DOCUMENTS') return { ...SYSTEM_DEFAULT, ...KIND_MAP[key] };
  return { ...SYSTEM_DEFAULT, ...KIND_MAP[key] };
}

export function formatNotificationRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff) || diff < 45_000) return 'только что';
  if (diff < 3600_000) return `${Math.max(1, Math.round(diff / 60_000))} мин`;
  if (diff < 24 * 3600_000) return `${Math.max(1, Math.round(diff / 3600_000))} ч`;
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(new Date(iso));
}

export function formatNotificationDateGroup(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Ранее';
  const today = new Date();
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diffDays = Math.round((startToday - startDate) / 86400000);
  if (diffDays === 0) return 'Сегодня';
  if (diffDays === 1) return 'Вчера';
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(date);
}

export function groupNotificationsByDate<T extends { createdAt: string }>(items: T[]): Array<{ label: string; items: T[] }> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const label = formatNotificationDateGroup(item.createdAt);
    const bucket = groups.get(label);
    if (bucket) bucket.push(item);
    else groups.set(label, [item]);
  }
  return Array.from(groups.entries()).map(([label, bucket]) => ({ label, items: bucket }));
}
