import { CalendarDays, CircleCheck, ClipboardList, UserRound } from 'lucide-react';

export type GuestFieldErrors = {
  fullName?: string;
  phone?: string;
  email?: string;
};

export type BookingPrefill = {
  serviceTitle?: string;
  categoryLabel?: string;
  consultationSummary?: string;
  fromConsultation?: boolean;
  serviceRequestId?: string;
  vehicleId?: string;
  fullName?: string;
  phone?: string;
};

export type CreatedBooking = { id: string };

export type QuickSlot = { id: string; label: string; dayLabel: string; hint: string; value: string };

export const BOOKING_STEPS = [
  {
    id: 1,
    label: 'Когда',
    title: 'Когда вам удобно?',
    description: 'Выберите слот — перезвоним для подтверждения.',
    icon: CalendarDays,
  },
  {
    id: 2,
    label: 'Контакты',
    title: 'Как с вами связаться?',
    description: 'Нужны только для уточнения деталей записи.',
    icon: UserRound,
  },
  {
    id: 3,
    label: 'Детали',
    title: 'Что привезти на сервис?',
    description: 'Опишите проблему — мастер подготовится заранее.',
    icon: ClipboardList,
  },
  {
    id: 4,
    label: 'Готово',
    title: 'Всё верно?',
    description: 'Проверьте данные и отправьте заявку.',
    icon: CircleCheck,
  },
] as const;

function pad(value: number) {
  return String(value).padStart(2, '0');
}

export function toDatetimeLocalValue(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function buildQuickSlots(): QuickSlot[] {
  const make = (daysFromNow: number, hour: number, minute: number, label: string, hint: string): QuickSlot => {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    date.setHours(hour, minute, 0, 0);
    const dayLabel = date.toLocaleDateString('ru-RU', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
    return { id: `${daysFromNow}-${hour}-${minute}`, label, dayLabel, hint, value: toDatetimeLocalValue(date) };
  };

  return [
    make(1, 10, 0, 'Завтра утром', '10:00'),
    make(1, 14, 0, 'Завтра днём', '14:00'),
    make(2, 11, 0, 'Послезавтра', '11:00'),
    make(3, 16, 0, 'Через 3 дня', '16:00'),
  ];
}

export function formatSummaryDate(value: string) {
  if (!value) return '—';
  return new Date(value).toLocaleString('ru-RU', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatCompactDate(value: string) {
  if (!value) return '';
  return new Date(value).toLocaleString('ru-RU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
