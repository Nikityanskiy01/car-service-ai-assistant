import type { ServiceRequestStatus } from '../types/serviceRequest';

export type ClientStatusTone =
  | 'new'
  | 'active'
  | 'scheduled'
  | 'done'
  | 'muted'
  | 'waiting'
  | 'confirmed'
  | 'arrived'
  | 'missed'
  | 'cancelled';

export type ClientStatusLegendItem = {
  status: string;
  label: string;
  description: string;
  tone: ClientStatusTone;
};

export const CLIENT_REQUEST_STATUS_LEGEND: ClientStatusLegendItem[] = [
  {
    status: 'NEW',
    label: 'Новая',
    description: 'Обращение создано — менеджер скоро возьмёт его в работу.',
    tone: 'new',
  },
  {
    status: 'IN_PROGRESS',
    label: 'В работе',
    description: 'Сервис разбирает проблему или уже ремонтирует автомобиль.',
    tone: 'active',
  },
  {
    status: 'SCHEDULED',
    label: 'Визит назначен',
    description: 'Назначен визит в сервис — смотрите раздел «Записи».',
    tone: 'scheduled',
  },
  {
    status: 'COMPLETED',
    label: 'Завершена',
    description: 'Работы выполнены, обращение в архиве.',
    tone: 'done',
  },
  {
    status: 'CANCELLED',
    label: 'Закрыта',
    description: 'Обращение закрыто без ремонта.',
    tone: 'cancelled',
  },
];

export const CLIENT_BOOKING_STATUS_LEGEND: ClientStatusLegendItem[] = [
  {
    status: 'PENDING',
    label: 'Ожидает',
    description: 'Визит запрошен — менеджер подтвердит время.',
    tone: 'waiting',
  },
  {
    status: 'CONFIRMED',
    label: 'Подтверждён',
    description: 'Ждём вас в сервис в указанное время.',
    tone: 'confirmed',
  },
  {
    status: 'ARRIVED',
    label: 'Приехал',
    description: 'Вы на сервисе, автомобиль принят.',
    tone: 'arrived',
  },
  {
    status: 'NO_SHOW',
    label: 'Не приехал',
    description: 'Визит пропущен — свяжитесь с сервисом для переноса.',
    tone: 'missed',
  },
  {
    status: 'CANCELLED',
    label: 'Отменён',
    description: 'Визит отменён.',
    tone: 'cancelled',
  },
];

export const CLIENT_STATUS_HELP_TITLE = 'Что означают статусы?';
export const CLIENT_STATUS_HELP_BUTTON = 'Подсказка по статусам';

export const CLIENT_STATUS_HELP_INTRO = {
  requests: 'Статусы обращений — от создания до завершения работ.',
  bookings: 'Статусы визитов — от запроса времени до приезда в сервис.',
} as const;

export const CLIENT_CALENDAR_FILE_HINT =
  'Файл .ics — это напоминание для календаря: Google, Apple (iPhone), Outlook или Яндекс. Скачайте и откройте — визит добавится автоматически.';

const ALL_STATUS_LEGEND = [...CLIENT_REQUEST_STATUS_LEGEND, ...CLIENT_BOOKING_STATUS_LEGEND];

const STATUS_TONE_BY_CODE = Object.fromEntries(
  ALL_STATUS_LEGEND.map((item) => [item.status, item.tone]),
) as Record<string, ClientStatusTone>;

const STATUS_LABEL_BY_CODE = Object.fromEntries(
  ALL_STATUS_LEGEND.map((item) => [item.status, item.label]),
) as Record<string, string>;

export function resolveClientStatusTone(status: string): ClientStatusTone {
  return STATUS_TONE_BY_CODE[status] ?? 'muted';
}

export function resolveClientStatusLabel(status: string): string {
  return STATUS_LABEL_BY_CODE[status] ?? status;
}
