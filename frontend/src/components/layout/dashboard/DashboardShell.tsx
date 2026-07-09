import { useMemo, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../../auth/AuthProvider';
import { adminNavGroups, managerNavItems } from '../../../config/dashboardNav';
import { DashboardSidebar } from './DashboardSidebar';
import { DashboardTopbar } from './DashboardTopbar';

export type DashboardOutletContext = {
  setPageTitle: (title: string) => void;
  setBadges: (badges: Record<string, number>) => void;
};

export function useDashboardContext() {
  // re-export hook from pages that import from here
  throw new Error('useDashboardContext must be imported from dashboard/useDashboardContext');
}

const routeTitles: Record<string, string> = {
  '/dashboard/manager': 'Рабочий стол',
  '/dashboard/manager/requests': 'Заявки',
  '/dashboard/manager/calendar': 'Календарь',
  '/dashboard/manager/clients': 'Клиенты',
  '/dashboard/manager/contacts': 'Обращения с сайта',
  '/dashboard/admin': 'Рабочий стол',
  '/dashboard/admin/analytics': 'Аналитика',
  '/dashboard/admin/users': 'Пользователи',
  '/dashboard/admin/content': 'Содержимое сайта',
  '/dashboard/admin/appearance': 'Оформление',
  '/dashboard/admin/requests': 'Заявки',
  '/dashboard/admin/bookings': 'Записи',
  '/dashboard/admin/integrations': 'Интеграции',
  '/dashboard/admin/integrations/jobs': 'Очередь синхронизации',
  '/dashboard/admin/audit': 'Журнал действий',
};

export function DashboardShell() {
  const { user } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pageTitle, setPageTitle] = useState('');
  const [badges, setBadges] = useState<Record<string, number>>({});

  const isAdmin = location.pathname.startsWith('/dashboard/admin');
  const isManager = location.pathname.startsWith('/dashboard/manager');

  const defaultTitle = useMemo(() => {
    const exact = routeTitles[location.pathname];
    if (exact) return exact;
    if (location.pathname.includes('/requests/')) return 'Заявка';
    if (location.pathname.includes('/integrations/')) return 'Подключение';
    return isAdmin ? 'Администрирование' : 'Кабинет менеджера';
  }, [location.pathname, isAdmin]);

  const title = pageTitle || defaultTitle;
  const outletContext: DashboardOutletContext = { setPageTitle, setBadges };

  return (
    <div className="dashboard-shell">
      {isManager && (user?.role === 'MANAGER' || user?.role === 'ADMINISTRATOR') ? (
        <DashboardSidebar
          items={managerNavItems}
          badges={badges}
          mobileOpen={mobileOpen}
          onMobileClose={() => setMobileOpen(false)}
        />
      ) : null}
      {isAdmin && user?.role === 'ADMINISTRATOR' ? (
        <DashboardSidebar
          items={[]}
          groups={adminNavGroups}
          badges={badges}
          mobileOpen={mobileOpen}
          onMobileClose={() => setMobileOpen(false)}
        />
      ) : null}

      <div className="dashboard-shell-main">
        <DashboardTopbar
          title={title}
          onMenuClick={() => setMobileOpen(true)}
          integrationIssues={badges.integrationIssues}
        />
        <div className="dashboard-shell-content">
          <Outlet context={outletContext} />
        </div>
      </div>
    </div>
  );
}
