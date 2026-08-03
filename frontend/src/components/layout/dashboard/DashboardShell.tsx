import { useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../../auth/AuthProvider';
import { getClientDashboardSummary } from '../../../api/dashboard';
import { resolveAdminRouteTitle } from '../../../config/adminRoutes';
import { adminNavGroups, clientNavItems, managerNavItems } from '../../../config/dashboardNav';
import { useAdminCommandPalette } from '../../../hooks/useAdminCommandPalette';
import { useTheme } from '../../../theme/ThemeProvider';
import { AdminBreadcrumbs } from '../../admin/AdminBreadcrumbs';
import { AdminCommandPalette } from '../../admin/AdminCommandPalette';
import { ClientBottomNav } from '../../client/ClientBottomNav';
import { ClientOnboarding } from '../../client/ClientOnboarding';
import { STORAGE_KEYS } from '../../../lib/storageKeys';
import { DashboardSidebar } from './DashboardSidebar';
import { DashboardTopbar } from './DashboardTopbar';

export type DashboardOutletContext = {
  setPageTitle: (title: string) => void;
  setBadges: (badges: Record<string, number>) => void;
};

const routeTitles: Record<string, string> = {
  '/dashboard/client': 'Кабинет клиента',
  '/dashboard/client/cases': 'Мои обращения',
  '/dashboard/client/bookings': 'Мои записи',
  '/dashboard/client/vehicles': 'Мои автомобили',
  '/dashboard/client/profile': 'Профиль',
  '/dashboard/manager': 'Рабочий стол',
  '/dashboard/manager/profile': 'Профиль',
  '/dashboard/manager/requests': 'Заявки',
  '/dashboard/manager/calendar': 'Календарь',
  '/dashboard/manager/clients': 'Клиенты',
  '/dashboard/manager/contacts': 'Обращения с сайта',
  '/dashboard/admin/profile': 'Профиль',
};

const ADMIN_THEME_INIT_KEY = 'car_service_admin_theme_initialized';

export function DashboardShell() {
  const { user } = useAuth();
  const location = useLocation();
  const { setMode } = useTheme();
  const commandPalette = useAdminCommandPalette();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pageTitle, setPageTitle] = useState('');
  const [badges, setBadges] = useState<Record<string, number>>({});
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [clientUnread, setClientUnread] = useState(0);

  const isAdmin = location.pathname.startsWith('/dashboard/admin');
  const isManager = location.pathname.startsWith('/dashboard/manager');
  const isClient = location.pathname.startsWith('/dashboard/client');
  const isClientUser = user?.role === 'CLIENT';

  useEffect(() => {
    if (!isAdmin || user?.role !== 'ADMINISTRATOR') return;
    if (!localStorage.getItem(ADMIN_THEME_INIT_KEY)) {
      setMode('dark');
      localStorage.setItem(ADMIN_THEME_INIT_KEY, '1');
    }
  }, [isAdmin, setMode, user?.role]);

  useEffect(() => {
    if (!isClient || !isClientUser) return;
    let cancelled = false;
    void (async () => {
      try {
        const summary = await getClientDashboardSummary();
        if (cancelled) return;
        const unread = summary.unreadMessagesCount || 0;
        setClientUnread(unread);
        setBadges({ 'client-cases': unread });
        if (!localStorage.getItem(STORAGE_KEYS.clientOnboardingDone)) {
          setOnboardingOpen(true);
        }
      } catch {
        if (!cancelled) {
          setClientUnread(0);
          setBadges({});
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // Refresh badge once per client-shell mount, not on every client sub-route.
  }, [isClient, isClientUser]);

  const defaultTitle = useMemo(() => {
    if (isAdmin) return resolveAdminRouteTitle(location.pathname);
    const exact = routeTitles[location.pathname];
    if (exact) return exact;
    if (location.pathname.includes('/cases/')) return 'Обращение';
    if (location.pathname.includes('/bookings/')) return 'Детали записи';
    if (location.pathname.includes('/requests/')) return 'Заявка';
    if (location.pathname.includes('/integrations/')) return 'Подключение';
    if (isManager) return 'Кабинет менеджера';
    return 'Кабинет клиента';
  }, [location.pathname, isAdmin, isManager]);

  const title = pageTitle || defaultTitle;
  const outletContext: DashboardOutletContext = { setPageTitle, setBadges };
  const roleLabel =
    user?.role === 'ADMINISTRATOR' ? 'Администратор' : user?.role === 'MANAGER' ? 'Менеджер' : 'Клиент';

  return (
    <div className={`dashboard-shell${mobileOpen ? ' mobile-nav-open' : ''}${isAdmin ? ' admin-zone' : ''}${isClient && isClientUser ? ' has-client-bottom-nav' : ''}`}>
      <a href="#dashboard-main" className="skip-link">
        К основному содержимому
      </a>
      {isClient ? (
        <DashboardSidebar
          items={clientNavItems}
          badges={badges}
          mobileOpen={mobileOpen}
          onMobileClose={() => setMobileOpen(false)}
          allowCollapse={false}
        />
      ) : null}
      {isManager && (user?.role === 'MANAGER' || user?.role === 'ADMINISTRATOR') ? (
        <DashboardSidebar
          items={managerNavItems}
          badges={badges}
          mobileOpen={mobileOpen}
          onMobileClose={() => setMobileOpen(false)}
          allowCollapse={false}
        />
      ) : null}
      {isAdmin && user?.role === 'ADMINISTRATOR' ? (
        <DashboardSidebar
          items={[]}
          groups={adminNavGroups}
          badges={badges}
          mobileOpen={mobileOpen}
          onMobileClose={() => setMobileOpen(false)}
          allowCollapse={false}
        />
      ) : null}

      <div className="dashboard-shell-main">
        <DashboardTopbar
          title={title}
          roleLabel={roleLabel}
          onMenuClick={() => setMobileOpen(true)}
          integrationIssues={badges.integrationIssues}
          adminZone={isAdmin}
          onCommandPalette={() => commandPalette.setOpen(true)}
        />
        <div className="dashboard-shell-content" id="dashboard-main">
          {isAdmin ? <AdminBreadcrumbs /> : null}
          <Outlet context={outletContext} />
        </div>
      </div>
      {isAdmin ? (
        <AdminCommandPalette
          open={commandPalette.open}
          query={commandPalette.query}
          items={commandPalette.items}
          onQueryChange={commandPalette.setQuery}
          onSelect={commandPalette.select}
          onClose={commandPalette.close}
        />
      ) : null}
      {isClient && isClientUser ? (
        <>
          <ClientBottomNav unreadCases={clientUnread} />
          <ClientOnboarding open={onboardingOpen} onClose={() => setOnboardingOpen(false)} />
        </>
      ) : null}
    </div>
  );
}
