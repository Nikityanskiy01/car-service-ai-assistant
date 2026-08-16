import type { UserRole } from '../types/auth';
import { adminPathForManagerPath } from './managerPaths';

/** Стартовый экран кабинета для каждой роли. */
export const DASHBOARD_HOME: Record<UserRole, string> = {
  CLIENT: '/dashboard/client',
  MANAGER: '/dashboard/manager',
  ADMINISTRATOR: '/dashboard/admin',
};

/** Страница профиля внутри «своей» зоны кабинета. */
export const DASHBOARD_PROFILE: Record<UserRole, string> = {
  CLIENT: '/dashboard/client/profile',
  MANAGER: '/dashboard/manager/profile',
  ADMINISTRATOR: '/dashboard/admin/profile',
};

export function dashboardHomeFor(role: UserRole | null | undefined): string {
  return role ? DASHBOARD_HOME[role] : DASHBOARD_HOME.CLIENT;
}

export function dashboardProfileFor(role: UserRole | null | undefined): string {
  return role ? DASHBOARD_PROFILE[role] : DASHBOARD_PROFILE.CLIENT;
}

/** Куда отправить сотрудника, пока не включена обязательная 2FA. */
export function totpSetupPathFor(role: UserRole | null | undefined): string {
  return `${dashboardProfileFor(role)}?tab=security&section=protection`;
}

export function isTotpSetupScreen(pathname: string, search = ''): boolean {
  const path = pathname.replace(/\/+$/, '') || '/';
  const isProfile =
    path === DASHBOARD_PROFILE.MANAGER ||
    path === DASHBOARD_PROFILE.ADMINISTRATOR ||
    path === DASHBOARD_PROFILE.CLIENT;
  if (!isProfile) return false;
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  return params.get('tab') === 'security';
}

/** Зона кабинета, которой принадлежит текущий путь. */
export function dashboardZoneFor(pathname: string): string {
  if (pathname.startsWith('/dashboard/admin')) return DASHBOARD_HOME.ADMINISTRATOR;
  if (pathname.startsWith('/dashboard/manager')) return DASHBOARD_HOME.MANAGER;
  return DASHBOARD_HOME.CLIENT;
}

/**
 * Клиентская зона показывает данные текущего пользователя (гараж, свои обращения),
 * поэтому сотруднику там делать нечего: он увидит пустой кабинет вместо рабочего стола.
 */
export function isDashboardPathAllowedFor(pathname: string, role: UserRole | null | undefined): boolean {
  if (!pathname.startsWith('/dashboard')) return true;
  if (!role) return false;
  if (pathname.startsWith('/dashboard/admin')) return role === 'ADMINISTRATOR';
  if (pathname.startsWith('/dashboard/manager')) return role === 'MANAGER';
  if (pathname.startsWith('/dashboard/client')) return role === 'CLIENT';
  return true;
}

/**
 * Куда отправить пользователя после входа: сохранённый `next` уважаем только
 * если он ведёт в доступную роли зону, иначе — на её рабочий стол.
 */
export function resolveRedirectFor(
  target: string | null | undefined,
  role: UserRole | null | undefined,
): string {
  if (!target) return dashboardHomeFor(role);
  const pathname = target.split('?')[0].split('#')[0];
  if (role === 'ADMINISTRATOR' && pathname.startsWith('/dashboard/manager')) {
    return adminPathForManagerPath(target);
  }
  return isDashboardPathAllowedFor(pathname, role) ? target : dashboardHomeFor(role);
}
