import { useAuth } from '../auth/AuthProvider';
import { hasAdminPermission, type AdminPermission } from '../config/adminPermissions';

export function useAdminPermission(permission: AdminPermission): boolean {
  const { user } = useAuth();
  return hasAdminPermission(user?.role, permission);
}

export function useAdminPermissions(): {
  can: (permission: AdminPermission) => boolean;
  isAdmin: boolean;
} {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMINISTRATOR';
  return {
    isAdmin,
    can: (permission) => hasAdminPermission(user?.role, permission),
  };
}
