/**
 * Операционные экраны переиспользуются в двух зонах: кабинет менеджера и
 * пульт администратора. Ссылки должны оставаться внутри текущей зоны, иначе
 * администратор внезапно проваливается в кабинет менеджера и теряет навигацию.
 */
export type ManagerZonePaths = {
  root: string;
  requests: string;
  calendar: string;
  clients: string;
  contacts: string;
  aiQuality: string;
  rootLabel: string;
};

const MANAGER_ZONE: ManagerZonePaths = {
  root: '/dashboard/manager',
  requests: '/dashboard/manager/requests',
  calendar: '/dashboard/manager/calendar',
  clients: '/dashboard/manager/clients',
  contacts: '/dashboard/manager/contacts',
  aiQuality: '/dashboard/manager/ai-quality',
  rootLabel: 'Рабочий стол',
};

const ADMIN_ZONE: ManagerZonePaths = {
  root: '/dashboard/admin',
  requests: '/dashboard/admin/operations/requests',
  calendar: '/dashboard/admin/operations/bookings',
  clients: '/dashboard/admin/operations/clients',
  contacts: '/dashboard/admin/operations/contacts',
  aiQuality: '/dashboard/admin/ai/feedback',
  rootLabel: 'Пульт',
};

export function managerZonePaths(adminZone?: boolean): ManagerZonePaths {
  return adminZone ? ADMIN_ZONE : MANAGER_ZONE;
}
