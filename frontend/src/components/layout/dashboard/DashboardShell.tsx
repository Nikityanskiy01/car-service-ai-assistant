import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../../auth/AuthProvider';
import { getClientDashboardSummary } from '../../../api/dashboard';
import { resolveAdminRouteTitle } from '../../../config/adminRoutes';
import { adminNavGroups, clientNavItems, managerNavItems } from '../../../config/dashboardNav';
import { dashboardZoneFor } from '../../../config/dashboardPaths';
import { useCommandPalette } from '../../../hooks/useCommandPalette';
import { useMediaQuery } from '../../../hooks/useMediaQuery';
import { useTheme } from '../../../theme/ThemeProvider';
import { AdminBreadcrumbs } from '../../admin/AdminBreadcrumbs';
import { CommandPalette } from '../../dashboard/CommandPalette';
import { ClientBottomNav } from '../../client/ClientBottomNav';
import { ClientOnboarding } from '../../client/ClientOnboarding';
import { STORAGE_KEYS } from '../../../lib/storageKeys';
import { bindDashboardChrome, DashboardContext, type DashboardContextValue } from './dashboardContext';
import { DashboardSidebar } from './DashboardSidebar';
import { DashboardTopbar } from './DashboardTopbar';
import { ManagerBottomNav } from '../../console/ManagerBottomNav';
import { ManagerSidebar } from '../../console/ManagerSidebar';
import { ManagerTopbar } from '../../console/ManagerTopbar';
import { Toaster } from '../../console/ui/sonner';
import { TooltipProvider } from '../../console/ui/tooltip';
import { useManagerNavBadges } from '../../../hooks/useManagerNavBadges';

export type { DashboardContextValue as DashboardOutletContext } from './dashboardContext';

const routeTitles: Record<string, string> = {
  '/dashboard/client': 'Кабинет клиента',
  '/dashboard/client/cases': 'Мои обращения',
  '/dashboard/client/bookings': 'Мои записи',
  '/dashboard/client/vehicles': 'Гараж',
  '/dashboard/client/profile': 'Профиль',
  '/dashboard/manager': 'Рабочий стол',
  '/dashboard/manager/profile': 'Профиль',
  '/dashboard/manager/requests': 'Очередь',
  '/dashboard/manager/calendar': 'Календарь',
  '/dashboard/manager/clients': 'Клиенты',
  '/dashboard/manager/contacts': 'Сообщения с сайта',
  '/dashboard/manager/ai-quality': 'Качество ИИ',
  '/dashboard/admin/profile': 'Профиль',
};

const ADMIN_THEME_INIT_KEY = 'car_service_admin_theme_initialized';

export function DashboardShell() {
  const { user } = useAuth();
  const location = useLocation();
  const { setMode } = useTheme();
  const commandPalette = useCommandPalette(
    location.pathname.startsWith('/dashboard/admin')
      ? 'admin'
      : location.pathname.startsWith('/dashboard/manager')
        ? 'manager'
        : null,
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pageTitle, setPageTitle] = useState('');
  const [badges, setBadges] = useState<Record<string, number>>({});
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [clientUnread, setClientUnread] = useState(0);

  const isAdmin = location.pathname.startsWith('/dashboard/admin');
  const isManager = location.pathname.startsWith('/dashboard/manager');
  const isClient = location.pathname.startsWith('/dashboard/client');
  const isClientUser = user?.role === 'CLIENT';
  const compactManagerNav = useMediaQuery('(max-width: 920px)');

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
  const dashboardContext = useMemo<DashboardContextValue>(() => ({ setPageTitle, setBadges }), []);
  // Bind during render so lazy pages can call setBadges on the first paint
  // even if they received a different context copy than this shell.
  bindDashboardChrome(dashboardContext);
  useLayoutEffect(() => bindDashboardChrome(dashboardContext), [dashboardContext]);
  const totpLock = Boolean(user?.totpSetupPending);
  useManagerNavBadges(
    !totpLock && isManager && (user?.role === 'MANAGER' || user?.role === 'ADMINISTRATOR'),
    setBadges,
  );
  const roleLabel =
    user?.role === 'ADMINISTRATOR' ? 'Администратор' : user?.role === 'MANAGER' ? 'Менеджер' : 'Клиент';
  const profilePath = `${dashboardZoneFor(location.pathname)}/profile`;

  return (
    <TooltipProvider>
    <div
      className={`dashboard-shell${mobileOpen ? ' mobile-nav-open' : ''}${isAdmin ? ' admin-zone' : ''}${isClient && isClientUser ? ' has-client-bottom-nav' : ''}${isManager && !totpLock ? ' has-manager-bottom-nav' : ''}`}
      data-console={isManager ? 'manager' : isAdmin ? 'admin' : undefined}
    >
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
      {isManager && !totpLock && !compactManagerNav && (user?.role === 'MANAGER' || user?.role === 'ADMINISTRATOR') ? (
        <ManagerSidebar
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
          allowCollapse
        />
      ) : null}

      <div className="dashboard-shell-main">
        {isManager ? (
          <ManagerTopbar
            title={totpLock ? 'Защита входа' : title}
            roleLabel={roleLabel}
            profilePath={profilePath}
            onMenuClick={() => setMobileOpen(true)}
            onCommandPalette={totpLock ? undefined : () => commandPalette.setOpen(true)}
            totpLock={totpLock}
          />
        ) : (
          <DashboardTopbar
            title={title}
            roleLabel={roleLabel}
            profilePath={profilePath}
            onMenuClick={() => setMobileOpen(true)}
            integrationIssues={user?.role === 'ADMINISTRATOR' ? badges.integrationIssues : undefined}
            adminZone={isAdmin}
            onCommandPalette={isAdmin ? () => commandPalette.setOpen(true) : undefined}
          />
        )}
        <main className="dashboard-shell-content" id="dashboard-main">
          {isAdmin ? <AdminBreadcrumbs /> : null}
          <DashboardContext.Provider value={dashboardContext}>
            <Outlet context={dashboardContext} />
          </DashboardContext.Provider>
        </main>
      </div>
      {isAdmin || (isManager && !totpLock) ? (
        <CommandPalette
          open={commandPalette.open}
          query={commandPalette.query}
          items={commandPalette.items}
          placeholder={isAdmin ? 'Поиск разделов админки…' : 'Разделы, фильтры очереди, действия…'}
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
      {isManager && !totpLock && (user?.role === 'MANAGER' || user?.role === 'ADMINISTRATOR') ? (
        <ManagerBottomNav
          badges={badges}
          onCommandPalette={() => commandPalette.setOpen(true)}
        />
      ) : null}
      {isManager ? <Toaster /> : null}
    </div>
    </TooltipProvider>
  );
}
