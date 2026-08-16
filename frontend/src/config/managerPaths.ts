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
  help: string;
  rootLabel: string;
};

const MANAGER_ZONE: ManagerZonePaths = {
  root: '/dashboard/manager',
  requests: '/dashboard/manager/requests',
  calendar: '/dashboard/manager/calendar',
  clients: '/dashboard/manager/clients',
  contacts: '/dashboard/manager/contacts',
  aiQuality: '/dashboard/manager/ai-quality',
  help: '/dashboard/manager/help',
  rootLabel: 'Рабочий стол',
};

const ADMIN_ZONE: ManagerZonePaths = {
  root: '/dashboard/admin',
  requests: '/dashboard/admin/operations/requests',
  calendar: '/dashboard/admin/operations/bookings',
  clients: '/dashboard/admin/operations/clients',
  contacts: '/dashboard/admin/operations/contacts',
  aiQuality: '/dashboard/admin/ai/feedback',
  help: '/dashboard/admin',
  rootLabel: 'Пульт',
};

export function managerZonePaths(adminZone?: boolean): ManagerZonePaths {
  return adminZone ? ADMIN_ZONE : MANAGER_ZONE;
}

const MANAGER_TO_ADMIN: Array<[string, string]> = [
  ['/dashboard/manager/requests', ADMIN_ZONE.requests],
  ['/dashboard/manager/calendar', ADMIN_ZONE.calendar],
  ['/dashboard/manager/clients', ADMIN_ZONE.clients],
  ['/dashboard/manager/contacts', ADMIN_ZONE.contacts],
  ['/dashboard/manager/ai-quality', ADMIN_ZONE.aiQuality],
  ['/dashboard/manager/help', ADMIN_ZONE.root],
  ['/dashboard/manager/profile', '/dashboard/admin/profile'],
  ['/dashboard/manager', ADMIN_ZONE.root],
];

/** Админ, попавший на URL менеджера, должен остаться в пульте. */
export function adminPathForManagerPath(target: string): string {
  const hashAt = target.indexOf('#');
  const queryAt = target.indexOf('?');
  const cutCandidates = [hashAt, queryAt].filter((index) => index >= 0);
  const cut = cutCandidates.length ? Math.min(...cutCandidates) : -1;
  const pathname = cut >= 0 ? target.slice(0, cut) : target;
  const rest = cut >= 0 ? target.slice(cut) : '';
  if (!pathname.startsWith('/dashboard/manager')) return target;

  for (const [from, to] of MANAGER_TO_ADMIN) {
    if (pathname === from || pathname.startsWith(`${from}/`)) {
      return `${to}${pathname.slice(from.length)}${rest}`;
    }
  }
  return `${ADMIN_ZONE.root}${rest}`;
}
