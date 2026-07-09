import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import type { UserRole } from '../types/auth';

export function RoleRoute({ roles, children }: { roles: UserRole[]; children: React.ReactNode }) {
  const { user, hasRole, isLoading } = useAuth();
  if (isLoading) return <div className="page-shell">Загрузка...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!hasRole(roles)) return <Navigate to="/403" replace />;
  return <>{children}</>;
}
