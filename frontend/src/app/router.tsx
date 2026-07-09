import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { PublicLayout } from '../components/layout/PublicLayout';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { ProtectedRoute } from '../auth/ProtectedRoute';
import { RoleRoute } from '../auth/RoleRoute';

const HomePage = lazy(() => import('../pages/public/HomePage').then((m) => ({ default: m.HomePage })));
const ServicesPage = lazy(() => import('../pages/public/ServicesPage').then((m) => ({ default: m.ServicesPage })));
const WorksPage = lazy(() => import('../pages/public/WorksPage').then((m) => ({ default: m.WorksPage })));
const GalleryPage = lazy(() => import('../pages/public/GalleryPage').then((m) => ({ default: m.GalleryPage })));
const AboutPage = lazy(() => import('../pages/public/AboutPage').then((m) => ({ default: m.AboutPage })));
const BookingPage = lazy(() => import('../pages/public/BookingPage').then((m) => ({ default: m.BookingPage })));
const ConsultPage = lazy(() => import('../pages/public/ConsultPage').then((m) => ({ default: m.ConsultPage })));
const LoginPage = lazy(() => import('../pages/auth/LoginPage').then((m) => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('../pages/auth/RegisterPage').then((m) => ({ default: m.RegisterPage })));
const ClientDashboardPage = lazy(() =>
  import('../pages/dashboards/ClientDashboardPage').then((m) => ({ default: m.ClientDashboardPage })),
);
const ManagerWorkDeskPage = lazy(() =>
  import('../pages/manager/ManagerWorkDeskPage').then((m) => ({ default: m.ManagerWorkDeskPage })),
);
const ManagerRequestsPage = lazy(() =>
  import('../pages/manager/ManagerRequestsPage').then((m) => ({ default: m.ManagerRequestsPage })),
);
const ManagerRequestDetailPage = lazy(() =>
  import('../pages/manager/ManagerRequestDetailPage').then((m) => ({ default: m.ManagerRequestDetailPage })),
);
const ManagerCalendarPage = lazy(() =>
  import('../pages/manager/ManagerCalendarPage').then((m) => ({ default: m.ManagerCalendarPage })),
);
const ManagerClientsPage = lazy(() =>
  import('../pages/manager/ManagerClientsPage').then((m) => ({ default: m.ManagerClientsPage })),
);
const ManagerContactsPage = lazy(() =>
  import('../pages/manager/ManagerContactsPage').then((m) => ({ default: m.ManagerContactsPage })),
);
const AdminOverviewPage = lazy(() =>
  import('../pages/admin/AdminOverviewPage').then((m) => ({ default: m.AdminOverviewPage })),
);
const AdminUsersPage = lazy(() => import('../pages/admin/AdminUsersPage').then((m) => ({ default: m.AdminUsersPage })));
const AdminIntegrationsPage = lazy(() =>
  import('../pages/admin/AdminIntegrationsPage').then((m) => ({ default: m.AdminIntegrationsPage })),
);
const AdminIntegrationDetailPage = lazy(() =>
  import('../pages/admin/AdminIntegrationDetailPage').then((m) => ({ default: m.AdminIntegrationDetailPage })),
);
const AdminIntegrationJobsPage = lazy(() =>
  import('../pages/admin/AdminIntegrationJobsPage').then((m) => ({ default: m.AdminIntegrationJobsPage })),
);
const AdminAnalyticsPage = lazy(() =>
  import('../pages/admin/AdminAnalyticsPage').then((m) => ({ default: m.AdminAnalyticsPage })),
);
const AdminAuditPage = lazy(() => import('../pages/admin/AdminAuditPage').then((m) => ({ default: m.AdminAuditPage })));
const AdminCmsPage = lazy(() => import('../pages/admin/AdminCmsPage').then((m) => ({ default: m.AdminCmsPage })));
const AdminAppearancePage = lazy(() =>
  import('../pages/admin/AdminAppearancePage').then((m) => ({ default: m.AdminAppearancePage })),
);
const ForbiddenPage = lazy(() =>
  import('../pages/errors/ForbiddenPage').then((m) => ({ default: m.ForbiddenPage })),
);
const NotFoundPage = lazy(() =>
  import('../pages/errors/NotFoundPage').then((m) => ({ default: m.NotFoundPage })),
);

const legacyRedirects: Record<string, string> = {
  '/index.html': '/',
  '/services.html': '/services',
  '/works.html': '/works',
  '/gallery.html': '/gallery',
  '/about.html': '/about',
  '/consult.html': '/consult',
  '/book-service.html': '/booking',
  '/login.html': '/login',
  '/register.html': '/register',
  '/location.html': '/about',
  '/dashboards/client.html': '/dashboard/client',
  '/dashboards/manager.html': '/dashboard/manager',
  '/dashboards/admin.html': '/dashboard/admin',
};

const legacyRoutes = Object.entries(legacyRedirects).map(([from, to]) => ({
  path: from,
  element: <Navigate to={to} replace />,
}));

export const router = createBrowserRouter([
  ...legacyRoutes,
  {
    path: '/',
    element: <PublicLayout />,
    children: [
      { index: true, element: withSuspense(<HomePage />) },
      { path: 'services', element: withSuspense(<ServicesPage />) },
      { path: 'works', element: withSuspense(<WorksPage />) },
      { path: 'gallery', element: withSuspense(<GalleryPage />) },
      { path: 'about', element: withSuspense(<AboutPage />) },
      { path: 'consult', element: withSuspense(<ConsultPage />) },
      { path: 'booking', element: withSuspense(<BookingPage />) },
      { path: 'login', element: withSuspense(<LoginPage />) },
      { path: 'register', element: withSuspense(<RegisterPage />) },
      { path: '403', element: withSuspense(<ForbiddenPage />) },
    ],
  },
  {
    path: '/dashboard',
    element: (
      <ProtectedRoute>
        <DashboardLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        path: 'client',
        element: (
          <RoleRoute roles={['CLIENT', 'MANAGER', 'ADMINISTRATOR']}>
            {withSuspense(<ClientDashboardPage />)}
          </RoleRoute>
        ),
      },
      {
        path: 'manager',
        element: withManager(<ManagerWorkDeskPage />),
      },
      { path: 'manager/requests', element: withManager(<ManagerRequestsPage />) },
      { path: 'manager/requests/:requestId', element: withManager(<ManagerRequestDetailPage />) },
      { path: 'manager/calendar', element: withManager(<ManagerCalendarPage />) },
      { path: 'manager/clients', element: withManager(<ManagerClientsPage />) },
      { path: 'manager/contacts', element: withManager(<ManagerContactsPage />) },
      { path: 'admin', element: withAdmin(<AdminOverviewPage />) },
      { path: 'admin/analytics', element: withAdmin(<AdminAnalyticsPage />) },
      { path: 'admin/users', element: withAdmin(<AdminUsersPage />) },
      { path: 'admin/content', element: withAdmin(<AdminCmsPage />) },
      { path: 'admin/appearance', element: withAdmin(<AdminAppearancePage />) },
      { path: 'admin/requests', element: withManager(<ManagerRequestsPage />) },
      { path: 'admin/bookings', element: withManager(<ManagerCalendarPage />) },
      { path: 'admin/integrations', element: withAdmin(<AdminIntegrationsPage />) },
      { path: 'admin/integrations/jobs', element: withAdmin(<AdminIntegrationJobsPage />) },
      { path: 'admin/integrations/:connectionId', element: withAdmin(<AdminIntegrationDetailPage />) },
      { path: 'admin/audit', element: withAdmin(<AdminAuditPage />) },
    ],
  },
  { path: '*', element: withSuspense(<NotFoundPage />) },
]);

function withManager(element: ReactNode) {
  return <RoleRoute roles={['MANAGER', 'ADMINISTRATOR']}>{withSuspense(element)}</RoleRoute>;
}

function withAdmin(element: ReactNode) {
  return <RoleRoute roles={['ADMINISTRATOR']}>{withSuspense(element)}</RoleRoute>;
}

function withSuspense(element: ReactNode) {
  return <Suspense fallback={<div className="page-suspense">Загрузка экрана...</div>}>{element}</Suspense>;
}
