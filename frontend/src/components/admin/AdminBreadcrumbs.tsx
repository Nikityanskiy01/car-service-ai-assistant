import { useLocation } from 'react-router-dom';
import { Breadcrumbs } from '../layout/dashboard/Breadcrumbs';
import { resolveAdminBreadcrumbs } from '../../config/adminRoutes';

export function AdminBreadcrumbs() {
  const { pathname } = useLocation();
  const items = resolveAdminBreadcrumbs(pathname);
  if (pathname === '/dashboard/admin') return null;
  return <Breadcrumbs items={items} />;
}
