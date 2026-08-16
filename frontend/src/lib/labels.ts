import type { IntegrationConnectionStatus, IntegrationProvider } from '../types/integration';
import type { ServiceRequestStatus } from '../types/serviceRequest';

export const SERVICE_REQUEST_STATUS_LABELS: Record<ServiceRequestStatus, string> = {
  NEW: 'Новая',
  IN_PROGRESS: 'В работе',
  SCHEDULED: 'Запланирована',
  COMPLETED: 'Завершена',
  CANCELLED: 'Отменена',
};

export const ROLE_LABELS: Record<string, string> = {
  CLIENT: 'Клиент',
  MANAGER: 'Менеджер',
  ADMINISTRATOR: 'Администратор',
};

export const INTEGRATION_PROVIDER_LABELS: Record<IntegrationProvider, string> = {
  ONE_C: '1С:Предприятие',
  AUTODEALER_DESKTOP: 'АвтоДилер (Desktop)',
  AUTODEALER_WEB: 'АвтоДилер Web',
  AUTODEALER_ONLINE: 'АвтоДилер Онлайн',
  BITRIX24: 'Bitrix24',
  AMOCRM: 'amoCRM',
  YCLIENTS: 'YCLIENTS',
  MOYSKLAD: 'МойСклад',
  MEGAPLAN: 'Мегаплан',
  GENERIC_REST: 'Универсальный REST',
  GENERIC_WEBHOOK: 'Webhook',
  FILE_EXCHANGE: 'Файловый обмен',
};

export const INTEGRATION_STATUS_LABELS: Record<IntegrationConnectionStatus, string> = {
  NOT_CONFIGURED: 'Не настроено',
  REQUIRES_SETUP: 'Требуется настройка',
  TESTING: 'Проверяется',
  CONNECTED: 'Подключено',
  LIMITED: 'Работает с ограничениями',
  AUTH_ERROR: 'Ошибка авторизации',
  UNAVAILABLE: 'Недоступно',
  PAUSED: 'Синхронизация приостановлена',
};

export const INTEGRATION_JOB_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Ожидает',
  PROCESSING: 'Выполняется',
  SUCCEEDED: 'Успешно',
  RETRYING: 'Повтор',
  FAILED: 'Ошибка',
  DEAD_LETTER: 'Требует внимания',
  CANCELLED: 'Отменена',
};

export const URGENCY_LABELS: Record<string, string> = {
  low: 'Не срочно',
  medium: 'Средняя срочность',
  high: 'Высокая срочность',
  critical: 'Критическая срочность',
};

export const URGENCY_HINTS: Record<string, string> = {
  low: 'Можно в обычную очередь: ТО, мелкий шум, расходники',
  medium: 'Важно, но не авария: диагностика в ближайшие 1–2 дня',
  high: 'Нужно взять раньше: тормоза, перегрев, машина плохо едет',
  critical: 'Опасно ехать: разбирать сразу',
};

export function formatUrgencyLabel(urgency?: string | null): string | null {
  if (!urgency) return null;
  return URGENCY_LABELS[urgency.toLowerCase()] ?? null;
}

export function urgencyHint(urgency?: string | null): string | undefined {
  if (!urgency) return undefined;
  return URGENCY_HINTS[urgency.toLowerCase()];
}

export function isUrgentLevel(urgency?: string | null): boolean {
  const key = String(urgency || '').toLowerCase();
  return key === 'high' || key === 'critical';
}

export const CONTACT_STATUS_LABELS: Record<string, string> = {
  NEW: 'Новое',
  IN_PROGRESS: 'В работе',
  CONVERTED: 'Заявка создана',
  CLOSED: 'Закрыто',
};

export const CONTACT_SOURCE_LABELS: Record<string, string> = {
  contact_form: 'Форма на сайте',
  about_page: 'Страница «О нас»',
  widget: 'Виджет',
};

export function formatRequestNumber(id: string): string {
  return id.slice(0, 8).toUpperCase();
}
