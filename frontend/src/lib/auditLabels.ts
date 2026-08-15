import type { AuditEvent } from '../types/dashboard';

const ACTION_LABELS: Record<string, string> = {
  DEMO_SEED: 'Демо-данные загружены',
  CMS_BLOCK_CREATE: 'Создан текстовый блок',
  CMS_BLOCK_UPDATE: 'Обновлён текстовый блок',
  CMS_BLOCK_ROLLBACK: 'Откат версии текстового блока',
  CMS_SITE_ITEM_CREATE: 'Добавлен элемент сайта',
  CMS_SITE_ITEM_UPDATE: 'Обновлён элемент сайта',
  CMS_SITE_ITEM_DELETE: 'Удалён элемент сайта',
  CMS_SITE_ITEM_REORDER: 'Изменён порядок элементов сайта',
  SITE_SETTINGS_UPDATE: 'Обновлены настройки сайта',
  USER_ROLE_UPDATE: 'Изменена роль пользователя',
  USER_BLOCKED: 'Пользователь заблокирован',
  USER_UNBLOCKED: 'Пользователь разблокирован',
  SESSION_REVOKE: 'Сессия завершена',
  SESSION_REVOKE_ALL: 'Все сессии пользователя завершены',
  INTEGRATION_CONNECT: 'Подключена интеграция',
  INTEGRATION_UPDATE: 'Обновлены настройки интеграции',
  REQUEST_STATUS_CHANGE: 'Изменён статус заявки',
};

const ENTITY_LABELS: Record<string, string> = {
  system: 'Система',
  site_item: 'Контент сайта',
  site_content_block: 'Текстовый блок',
  site_settings: 'Настройки сайта',
  user: 'Пользователь',
  integration_connection: 'Интеграция',
  service_request: 'Заявка',
};

export function auditActionOptions(): Array<{ value: string; label: string }> {
  return Object.entries(ACTION_LABELS).map(([value, label]) => ({ value, label }));
}

export function auditActionLabel(action: string): string {
  if (ACTION_LABELS[action]) return ACTION_LABELS[action];
  if (action.includes('blocked')) return 'Пользователь заблокирован';
  if (action.includes('unblocked')) return 'Пользователь разблокирован';
  if (action.toLowerCase().includes('role')) return 'Изменена роль пользователя';
  if (action.includes('CMS') || action.includes('SITE')) return 'Изменение контента сайта';
  if (action.includes('INTEGRATION')) return 'Изменение интеграции';
  return action || 'Действие в системе';
}

export function auditEntityLabel(entityType?: string | null): string {
  if (!entityType) return '—';
  return ENTITY_LABELS[entityType] || entityType;
}

export function auditEventDetail(event: AuditEvent): string {
  const payload = event.payload as Record<string, unknown> | undefined;
  if (!payload) return '';
  const parts: string[] = [];
  if (payload.kind) parts.push(String(payload.kind));
  if (payload.title) parts.push(String(payload.title));
  if (payload.from && payload.to) parts.push(`${String(payload.from)} → ${String(payload.to)}`);
  if (payload.role) parts.push(`роль: ${String(payload.role)}`);
  if (payload.provider) parts.push(String(payload.provider));
  if (payload.note) parts.push(String(payload.note));
  return parts.join(' · ');
}

export function auditEventsToCsv(events: AuditEvent[]): string {
  const header = 'createdAt,actorEmail,action,entityType,entityId,detail';
  const rows = events.map((e) => {
    const cols = [
      e.createdAt,
      e.actorEmail || e.actor?.email || '',
      e.action,
      e.entityType || '',
      e.entityId || '',
      auditEventDetail(e).replace(/"/g, '""'),
    ];
    return cols.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',');
  });
  return [header, ...rows].join('\n');
}
