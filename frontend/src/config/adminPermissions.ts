export type AdminPermission =
  | 'analytics.view'
  | 'integrations.manage'
  | 'users.manage'
  | 'security.audit'
  | 'ai.studio'
  | 'site.cms'
  | 'operations.all'
  | 'team.activity';

const ADMINISTRATOR_PERMISSIONS: AdminPermission[] = [
  'analytics.view',
  'integrations.manage',
  'users.manage',
  'security.audit',
  'ai.studio',
  'site.cms',
  'operations.all',
  'team.activity',
];

const PERMISSION_ROUTES: Partial<Record<AdminPermission, string>> = {
  'analytics.view': '/dashboard/admin/analytics',
  'integrations.manage': '/dashboard/admin/integrations',
  'users.manage': '/dashboard/admin/team/users',
  'security.audit': '/dashboard/admin/security/audit',
  'ai.studio': '/dashboard/admin/ai/status',
  'site.cms': '/dashboard/admin/site/items',
  'operations.all': '/dashboard/admin/operations/requests',
  'team.activity': '/dashboard/admin/team/activity',
};

export function hasAdminPermission(role: string | undefined, permission: AdminPermission): boolean {
  if (role === 'ADMINISTRATOR') return ADMINISTRATOR_PERMISSIONS.includes(permission);
  return false;
}

export function permissionForPath(pathname: string): AdminPermission | null {
  if (pathname.startsWith('/dashboard/admin/analytics')) return 'analytics.view';
  if (pathname.startsWith('/dashboard/admin/integrations')) return 'integrations.manage';
  if (pathname.startsWith('/dashboard/admin/team/users')) return 'users.manage';
  if (pathname.startsWith('/dashboard/admin/team/activity')) return 'team.activity';
  if (pathname.startsWith('/dashboard/admin/security')) return 'security.audit';
  if (pathname.startsWith('/dashboard/admin/ai')) return 'ai.studio';
  if (pathname.startsWith('/dashboard/admin/site')) return 'site.cms';
  if (pathname.startsWith('/dashboard/admin/operations')) return 'operations.all';
  return null;
}

export function routeRequiresPermission(pathname: string): boolean {
  return pathname.startsWith('/dashboard/admin');
}

export { PERMISSION_ROUTES };
