import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter, Navigate, useParams } from 'react-router-dom';
import { PageSuspenseFallback } from '../components/ui/PageSuspenseFallback';
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
const PrivacyPage = lazy(() => import('../pages/public/PrivacyPage').then((m) => ({ default: m.PrivacyPage })));
const TermsPage = lazy(() => import('../pages/public/TermsPage').then((m) => ({ default: m.TermsPage })));
const LoginPage = lazy(() => import('../pages/auth/LoginPage').then((m) => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('../pages/auth/RegisterPage').then((m) => ({ default: m.RegisterPage })));
const ClientOverviewPage = lazy(() =>
  import('../pages/dashboards/client/ClientOverviewPage').then((m) => ({ default: m.ClientOverviewPage })),
);
const ClientCasesPage = lazy(() =>
  import('../pages/dashboards/client/ClientCasesPage').then((m) => ({ default: m.ClientCasesPage })),
);
const ClientCaseDetailPage = lazy(() =>
  import('../pages/dashboards/client/ClientCaseDetailPage').then((m) => ({ default: m.ClientCaseDetailPage })),
);
const ClientBookingsPage = lazy(() =>
  import('../pages/dashboards/client/ClientBookingsPage').then((m) => ({ default: m.ClientBookingsPage })),
);
const ClientBookingDetailPage = lazy(() =>
  import('../pages/dashboards/client/ClientBookingDetailPage').then((m) => ({
    default: m.ClientBookingDetailPage,
  })),
);
const ProfilePage = lazy(() => import('../pages/dashboards/ProfilePage').then((m) => ({ default: m.ProfilePage })));
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
const ManagerAiQualityPage = lazy(() =>
  import('../pages/manager/ManagerAiQualityPage').then((m) => ({ default: m.ManagerAiQualityPage })),
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
const AdminIntegrationConflictsPage = lazy(() =>
  import('../pages/admin/AdminIntegrationConflictsPage').then((m) => ({
    default: m.AdminIntegrationConflictsPage,
  })),
);
const AdminAnalyticsPage = lazy(() =>
  import('../pages/admin/AdminAnalyticsPage').then((m) => ({ default: m.AdminAnalyticsPage })),
);
const AdminAuditPage = lazy(() => import('../pages/admin/AdminAuditPage').then((m) => ({ default: m.AdminAuditPage })));
const AdminSiteItemsPage = lazy(() =>
  import('../pages/admin/site/AdminSiteItemsPage').then((m) => ({ default: m.AdminSiteItemsPage })),
);
const AdminSiteBlocksPage = lazy(() =>
  import('../pages/admin/site/AdminSiteBlocksPage').then((m) => ({ default: m.AdminSiteBlocksPage })),
);
const AdminSiteAppearancePage = lazy(() =>
  import('../pages/admin/site/AdminSiteAppearancePage').then((m) => ({ default: m.AdminSiteAppearancePage })),
);
const AdminSiteLegalPage = lazy(() =>
  import('../pages/admin/site/AdminSiteLegalPage').then((m) => ({ default: m.AdminSiteLegalPage })),
);
const AdminTeamActivityPage = lazy(() =>
  import('../pages/admin/team/AdminTeamActivityPage').then((m) => ({ default: m.AdminTeamActivityPage })),
);
const AdminPlaceholderPage = lazy(() =>
  import('../pages/admin/AdminPlaceholderPage').then((m) => ({ default: m.AdminPlaceholderPage })),
);
const AdminAiStatusPage = lazy(() =>
  import('../pages/admin/ai/AdminAiStatusPage').then((m) => ({ default: m.AdminAiStatusPage })),
);
const AdminAiScenariosPage = lazy(() =>
  import('../pages/admin/ai/AdminAiScenariosPage').then((m) => ({ default: m.AdminAiScenariosPage })),
);
const AdminAiReferencePage = lazy(() =>
  import('../pages/admin/ai/AdminAiReferencePage').then((m) => ({ default: m.AdminAiReferencePage })),
);
const AdminAiFeedbackPage = lazy(() =>
  import('../pages/admin/ai/AdminAiFeedbackPage').then((m) => ({ default: m.AdminAiFeedbackPage })),
);
const AdminAiMemoryPage = lazy(() =>
  import('../pages/admin/ai/AdminAiMemoryPage').then((m) => ({ default: m.AdminAiMemoryPage })),
);
const ForbiddenPage = lazy(() =>
  import('../pages/errors/ForbiddenPage').then((m) => ({ default: m.ForbiddenPage })),
);
const StatusErrorPage = lazy(() =>
  import('../pages/errors/StatusErrorPage').then((m) => ({ default: m.StatusErrorPage })),
);
const NotFoundPage = lazy(() =>
  import('../pages/errors/NotFoundPage').then((m) => ({ default: m.NotFoundPage })),
);
const DashboardNotFoundPage = lazy(() =>
  import('../pages/errors/DashboardNotFoundPage').then((m) => ({ default: m.DashboardNotFoundPage })),
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
  '/dashboard/admin/users': '/dashboard/admin/team/users',
  '/dashboard/admin/requests': '/dashboard/admin/operations/requests',
  '/dashboard/admin/bookings': '/dashboard/admin/operations/bookings',
  '/dashboard/admin/content': '/dashboard/admin/site/items',
  '/dashboard/admin/appearance': '/dashboard/admin/site/appearance',
  '/dashboard/admin/audit': '/dashboard/admin/security/audit',
  '/dashboard/client/requests': '/dashboard/client/cases',
  '/dashboard/client/consultations': '/dashboard/client/cases?tab=drafts',
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
      { path: 'bookings', element: <Navigate to="/dashboard/client/bookings" replace /> },
      { path: 'my-bookings', element: <Navigate to="/dashboard/client/bookings" replace /> },
      { path: 'privacy', element: withSuspense(<PrivacyPage />) },
      { path: 'terms', element: withSuspense(<TermsPage />) },
      { path: 'login', element: withSuspense(<LoginPage />) },
      { path: 'register', element: withSuspense(<RegisterPage />) },
      { path: '401', element: withSuspense(<StatusErrorPage code={401} />) },
      { path: '402', element: withSuspense(<StatusErrorPage code={402} />) },
      { path: '403', element: withSuspense(<ForbiddenPage />) },
      { path: '429', element: withSuspense(<StatusErrorPage code={429} />) },
      { path: '500', element: withSuspense(<StatusErrorPage code={500} />) },
      { path: '502', element: withSuspense(<StatusErrorPage code={502} />) },
      { path: '503', element: withSuspense(<StatusErrorPage code={503} />) },
      { path: '504', element: withSuspense(<StatusErrorPage code={504} />) },
      { path: '*', element: withSuspense(<NotFoundPage />) },
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
            {withSuspense(<ClientOverviewPage />)}
          </RoleRoute>
        ),
      },
      {
        path: 'client/cases',
        element: (
          <RoleRoute roles={['CLIENT', 'MANAGER', 'ADMINISTRATOR']}>
            {withSuspense(<ClientCasesPage />)}
          </RoleRoute>
        ),
      },
      {
        path: 'client/cases/:caseId',
        element: (
          <RoleRoute roles={['CLIENT', 'MANAGER', 'ADMINISTRATOR']}>
            {withSuspense(<ClientCaseDetailPage />)}
          </RoleRoute>
        ),
      },
      {
        path: 'client/requests',
        element: <Navigate to="/dashboard/client/cases" replace />,
      },
      {
        path: 'client/requests/:requestId',
        element: <LegacyClientRequestRedirect />,
      },
      {
        path: 'client/consultations',
        element: <Navigate to="/dashboard/client/cases?tab=drafts" replace />,
      },
      {
        path: 'client/bookings',
        element: (
          <RoleRoute roles={['CLIENT', 'MANAGER', 'ADMINISTRATOR']}>
            {withSuspense(<ClientBookingsPage />)}
          </RoleRoute>
        ),
      },
      {
        path: 'client/bookings/:bookingId',
        element: (
          <RoleRoute roles={['CLIENT']}>
            {withSuspense(<ClientBookingDetailPage />)}
          </RoleRoute>
        ),
      },
      {
        path: 'client/profile',
        element: (
          <RoleRoute roles={['CLIENT', 'MANAGER', 'ADMINISTRATOR']}>
            {withSuspense(<ProfilePage />)}
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
      { path: 'manager/ai-quality', element: withManager(<ManagerAiQualityPage />) },
      { path: 'manager/profile', element: withManager(<ProfilePage />) },
      { path: 'admin', element: withAdmin(<AdminOverviewPage />) },
      { path: 'admin/analytics', element: withAdmin(<AdminAnalyticsPage />) },
      { path: 'admin/operations/requests', element: withAdmin(<ManagerRequestsPage adminZone />) },
      { path: 'admin/operations/bookings', element: withAdmin(<ManagerCalendarPage adminZone />) },
      { path: 'admin/operations/clients', element: withAdmin(<ManagerClientsPage adminZone />) },
      { path: 'admin/operations/contacts', element: withAdmin(<ManagerContactsPage adminZone />) },
      { path: 'admin/team/users', element: withAdmin(<AdminUsersPage />) },
      {
        path: 'admin/team/activity',
        element: withAdmin(<AdminTeamActivityPage />),
      },
      { path: 'admin/ai/status', element: withAdmin(<AdminAiStatusPage />) },
      { path: 'admin/ai/scenarios', element: withAdmin(<AdminAiScenariosPage />) },
      { path: 'admin/ai/reference', element: withAdmin(<AdminAiReferencePage />) },
      { path: 'admin/ai/memory', element: withAdmin(<AdminAiMemoryPage />) },
      { path: 'admin/ai/feedback', element: withAdmin(<AdminAiFeedbackPage />) },
      { path: 'admin/site/items', element: withAdmin(<AdminSiteItemsPage />) },
      { path: 'admin/site/blocks', element: withAdmin(<AdminSiteBlocksPage />) },
      { path: 'admin/site/appearance', element: withAdmin(<AdminSiteAppearancePage />) },
      { path: 'admin/site/legal', element: withAdmin(<AdminSiteLegalPage />) },
      { path: 'admin/users', element: <Navigate to="/dashboard/admin/team/users" replace /> },
      { path: 'admin/requests', element: <Navigate to="/dashboard/admin/operations/requests" replace /> },
      { path: 'admin/bookings', element: <Navigate to="/dashboard/admin/operations/bookings" replace /> },
      { path: 'admin/content', element: <Navigate to="/dashboard/admin/site/items" replace /> },
      { path: 'admin/appearance', element: <Navigate to="/dashboard/admin/site/appearance" replace /> },
      { path: 'admin/audit', element: <Navigate to="/dashboard/admin/security/audit" replace /> },
      { path: 'admin/integrations', element: withAdmin(<AdminIntegrationsPage />) },
      { path: 'admin/integrations/jobs', element: withAdmin(<AdminIntegrationJobsPage />) },
      {
        path: 'admin/integrations/conflicts',
        element: withAdmin(<AdminIntegrationConflictsPage />),
      },
      { path: 'admin/integrations/:connectionId', element: withAdmin(<AdminIntegrationDetailPage />) },
      { path: 'admin/security/audit', element: withAdmin(<AdminAuditPage />) },
      { path: 'admin/profile', element: withAdmin(<ProfilePage />) },
      { path: '*', element: withSuspense(<DashboardNotFoundPage />) },
    ],
  },
]);

function withManager(element: ReactNode) {
  return <RoleRoute roles={['MANAGER', 'ADMINISTRATOR']}>{withSuspense(element)}</RoleRoute>;
}

function withAdmin(element: ReactNode) {
  return <RoleRoute roles={['ADMINISTRATOR']}>{withSuspense(element)}</RoleRoute>;
}

function withSuspense(element: ReactNode) {
  return <Suspense fallback={<PageSuspenseFallback />}>{element}</Suspense>;
}

function LegacyClientRequestRedirect() {
  const { requestId = '' } = useParams();
  return <Navigate to={`/dashboard/client/cases/${requestId}`} replace />;
}
