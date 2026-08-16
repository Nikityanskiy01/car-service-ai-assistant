import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { isTotpSetupScreen, totpSetupPathFor } from '../config/dashboardPaths';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <div className="page-shell">Загрузка...</div>;
  if (!isAuthenticated) {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }
  if (user?.totpSetupPending && !isTotpSetupScreen(location.pathname, location.search)) {
    return <Navigate to={totpSetupPathFor(user.role)} replace />;
  }
  return <>{children}</>;
}
