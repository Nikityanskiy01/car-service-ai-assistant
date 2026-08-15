import type { BreadcrumbItem } from '../components/layout/dashboard/Breadcrumbs';

/** Заголовки страниц админ-зоны для topbar */
export const adminRouteTitles: Record<string, string> = {
  '/dashboard/admin': 'Пульт',
  '/dashboard/admin/analytics': 'Аналитика',
  '/dashboard/admin/operations/requests': 'Заявки',
  '/dashboard/admin/operations/bookings': 'Записи',
  '/dashboard/admin/operations/clients': 'Клиенты',
  '/dashboard/admin/operations/contacts': 'Обращения',
  '/dashboard/admin/team/users': 'Пользователи',
  '/dashboard/admin/team/activity': 'Активность',
  '/dashboard/admin/ai/status': 'Статус и модели',
  '/dashboard/admin/ai/scenarios': 'Сценарии',
  '/dashboard/admin/ai/reference': 'Справочники',
  '/dashboard/admin/ai/memory': 'Память кейсов',
  '/dashboard/admin/ai/feedback': 'Обратная связь',
  '/dashboard/admin/site/items': 'Услуги и галерея',
  '/dashboard/admin/site/blocks': 'Текстовые блоки',
  '/dashboard/admin/site/appearance': 'Оформление',
  '/dashboard/admin/site/legal': 'Юридические данные',
  '/dashboard/admin/integrations': 'Подключения',
  '/dashboard/admin/integrations/jobs': 'Очередь',
  '/dashboard/admin/integrations/conflicts': 'Конфликты',
  '/dashboard/admin/security/audit': 'Журнал действий',
  '/dashboard/admin/security/sessions': 'Сессии',
  '/dashboard/admin/profile': 'Профиль',
};

const operationsCrumbs: BreadcrumbItem[] = [
  { label: 'Пульт', to: '/dashboard/admin' },
  { label: 'Операции' },
];

const teamCrumbs: BreadcrumbItem[] = [
  { label: 'Пульт', to: '/dashboard/admin' },
  { label: 'Команда' },
];

const aiCrumbs: BreadcrumbItem[] = [
  { label: 'Пульт', to: '/dashboard/admin' },
  { label: 'ИИ-студия' },
];

const siteCrumbs: BreadcrumbItem[] = [
  { label: 'Пульт', to: '/dashboard/admin' },
  { label: 'Сайт и бренд' },
];

const integrationsCrumbs: BreadcrumbItem[] = [
  { label: 'Пульт', to: '/dashboard/admin' },
  { label: 'Интеграции', to: '/dashboard/admin/integrations' },
];

const securityCrumbs: BreadcrumbItem[] = [
  { label: 'Пульт', to: '/dashboard/admin' },
  { label: 'Безопасность' },
];

export const adminBreadcrumbsByPath: Record<string, BreadcrumbItem[]> = {
  '/dashboard/admin': [{ label: 'Пульт' }],
  '/dashboard/admin/analytics': [{ label: 'Пульт', to: '/dashboard/admin' }, { label: 'Аналитика' }],
  '/dashboard/admin/operations/requests': [...operationsCrumbs, { label: 'Заявки' }],
  '/dashboard/admin/operations/bookings': [...operationsCrumbs, { label: 'Записи' }],
  '/dashboard/admin/operations/clients': [...operationsCrumbs, { label: 'Клиенты' }],
  '/dashboard/admin/operations/contacts': [...operationsCrumbs, { label: 'Обращения' }],
  '/dashboard/admin/team/users': [...teamCrumbs, { label: 'Пользователи' }],
  '/dashboard/admin/team/activity': [...teamCrumbs, { label: 'Активность' }],
  '/dashboard/admin/ai/status': [...aiCrumbs, { label: 'Статус и модели' }],
  '/dashboard/admin/ai/scenarios': [...aiCrumbs, { label: 'Сценарии' }],
  '/dashboard/admin/ai/reference': [...aiCrumbs, { label: 'Справочники' }],
  '/dashboard/admin/ai/memory': [...aiCrumbs, { label: 'Память кейсов' }],
  '/dashboard/admin/ai/feedback': [...aiCrumbs, { label: 'Обратная связь' }],
  '/dashboard/admin/site/items': [...siteCrumbs, { label: 'Услуги и галерея' }],
  '/dashboard/admin/site/blocks': [...siteCrumbs, { label: 'Текстовые блоки' }],
  '/dashboard/admin/site/appearance': [...siteCrumbs, { label: 'Оформление' }],
  '/dashboard/admin/site/legal': [...siteCrumbs, { label: 'Юридические данные' }],
  '/dashboard/admin/integrations': [{ label: 'Пульт', to: '/dashboard/admin' }, { label: 'Интеграции' }],
  '/dashboard/admin/integrations/jobs': [...integrationsCrumbs, { label: 'Очередь' }],
  '/dashboard/admin/integrations/conflicts': [...integrationsCrumbs, { label: 'Конфликты' }],
  '/dashboard/admin/security/audit': [...securityCrumbs, { label: 'Журнал действий' }],
  '/dashboard/admin/security/sessions': [...securityCrumbs, { label: 'Сессии' }],
  '/dashboard/admin/profile': [{ label: 'Пульт', to: '/dashboard/admin' }, { label: 'Профиль' }],
};

export function resolveAdminRouteTitle(pathname: string): string {
  const exact = adminRouteTitles[pathname];
  if (exact) return exact;
  if (pathname.startsWith('/dashboard/admin/operations/requests/')) return 'Заявка';
  if (pathname.includes('/integrations/') && !pathname.endsWith('/jobs') && !pathname.endsWith('/conflicts')) {
    return 'Подключение';
  }
  return 'Администрирование';
}

export function resolveAdminBreadcrumbs(pathname: string): BreadcrumbItem[] {
  const exact = adminBreadcrumbsByPath[pathname];
  if (exact) return exact;
  if (pathname.startsWith('/dashboard/admin/operations/requests/')) {
    return [...operationsCrumbs, { label: 'Заявки', to: '/dashboard/admin/operations/requests' }, { label: 'Заявка' }];
  }
  if (pathname.includes('/integrations/')) {
    return [...integrationsCrumbs, { label: 'Подключение' }];
  }
  return [{ label: 'Пульт', to: '/dashboard/admin' }];
}
