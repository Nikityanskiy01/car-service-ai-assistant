import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter, Navigate, Outlet, useLocation, useOutletContext, useParams } from 'react-router-dom';
import { PageSuspenseFallback } from '../components/ui/PageSuspenseFallback';
import { PublicLayout } from '../components/layout/PublicLayout';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { ProtectedRoute } from '../auth/ProtectedRoute';
import { RoleRoute } from '../auth/RoleRoute';
import { useAuth } from '../auth/AuthProvider';
import { dashboardHomeFor, dashboardProfileFor } from '../config/dashboardPaths';
import { adminPathForManagerPath } from '../config/managerPaths';
import type { UserRole } from '../types/auth';

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
const ForgotPasswordPage = lazy(() =>
  import('../pages/auth/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage })),
);
const ResetPasswordPage = lazy(() =>
  import('../pages/auth/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage })),
);
const VerifyEmailPage = lazy(() =>
  import('../pages/auth/VerifyEmailPage').then((m) => ({ default: m.VerifyEmailPage })),
);
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
const ClientVehiclesPage = lazy(() =>
  import('../pages/dashboards/client/ClientVehiclesPage').then((m) => ({ default: m.ClientVehiclesPage })),
);
const ClientVehicleDetailPage = lazy(() =>
  import('../pages/dashboards/client/ClientVehicleDetailPage').then((m) => ({
    default: m.ClientVehicleDetailPage,
  })),
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
const ManagerAiQualityPage = lazy(() =>
  import('../pages/manager/ManagerAiQualityPage').then((m) => ({ default: m.ManagerAiQualityPage })),
);
const ManagerHelpPage = lazy(() =>
  import('../pages/manager/ManagerHelpPage').then((m) => ({ default: m.ManagerHelpPage })),
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
const AdminSessionsPage = lazy(() =>
  import('../pages/admin/AdminSessionsPage').then((m) => ({ default: m.AdminSessionsPage })),
);
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
const DashboardErrorPage = lazy(() =>
  import('../pages/errors/DashboardErrorPage').then((m) => ({ default: m.DashboardErrorPage })),
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

const clientRoutes = [
  { index: true, element: withSuspense(<ClientOverviewPage />) },
  { path: 'cases', element: withSuspense(<ClientCasesPage />) },
  { path: 'cases/:caseId', element: withSuspense(<ClientCaseDetailPage />) },
  { path: 'bookings', element: withSuspense(<ClientBookingsPage />) },
  { path: 'bookings/:bookingId', element: withSuspense(<ClientBookingDetailPage />) },
  { path: 'profile', element: withSuspense(<ProfilePage />) },
  {
    element: <RoleSection roles={['CLIENT']} />,
    children: [
      { path: 'vehicles', element: withSuspense(<ClientVehiclesPage />) },
      { path: 'vehicles/:vehicleId', element: withSuspense(<ClientVehicleDetailPage />) },
    ],
  },
  { path: 'requests', element: <Navigate to="/dashboard/client/cases" replace /> },
  { path: 'requests/:requestId', element: <LegacyClientRequestRedirect /> },
  { path: 'consultations', element: <Navigate to="/dashboard/client/cases?tab=drafts" replace /> },
  { path: '*', element: withSuspense(<DashboardNotFoundPage />) },
];

const managerRoutes = [
  { index: true, element: withSuspense(<ManagerWorkDeskPage />) },
  { path: 'requests', element: withSuspense(<ManagerRequestsPage />) },
  { path: 'requests/:requestId', element: withSuspense(<ManagerRequestDetailPage />) },
  { path: 'calendar', element: withSuspense(<ManagerCalendarPage />) },
  { path: 'clients', element: withSuspense(<ManagerClientsPage />) },
  { path: 'contacts', element: withSuspense(<ManagerContactsPage />) },
  { path: 'ai-quality', element: withSuspense(<ManagerAiQualityPage />) },
  { path: 'help', element: withSuspense(<ManagerHelpPage />) },
  { path: 'profile', element: withSuspense(<ProfilePage />) },
  { path: '*', element: withSuspense(<DashboardNotFoundPage />) },
];

const adminRoutes = [
  { index: true, element: withSuspense(<AdminOverviewPage />) },
  { path: 'analytics', element: withSuspense(<AdminAnalyticsPage />) },
  { path: 'operations/requests', element: withSuspense(<ManagerRequestsPage adminZone />) },
  { path: 'operations/requests/:requestId', element: withSuspense(<ManagerRequestDetailPage adminZone />) },
  { path: 'operations/bookings', element: withSuspense(<ManagerCalendarPage adminZone />) },
  { path: 'operations/clients', element: withSuspense(<ManagerClientsPage adminZone />) },
  { path: 'operations/contacts', element: withSuspense(<ManagerContactsPage adminZone />) },
  { path: 'team/users', element: withSuspense(<AdminUsersPage />) },
  { path: 'team/activity', element: withSuspense(<AdminTeamActivityPage />) },
  { path: 'ai/status', element: withSuspense(<AdminAiStatusPage />) },
  { path: 'ai/scenarios', element: withSuspense(<AdminAiScenariosPage />) },
  { path: 'ai/reference', element: withSuspense(<AdminAiReferencePage />) },
  { path: 'ai/memory', element: withSuspense(<AdminAiMemoryPage />) },
  { path: 'ai/feedback', element: withSuspense(<AdminAiFeedbackPage />) },
  { path: 'site/items', element: withSuspense(<AdminSiteItemsPage />) },
  { path: 'site/blocks', element: withSuspense(<AdminSiteBlocksPage />) },
  { path: 'site/appearance', element: withSuspense(<AdminSiteAppearancePage />) },
  { path: 'site/legal', element: withSuspense(<AdminSiteLegalPage />) },
  { path: 'integrations', element: withSuspense(<AdminIntegrationsPage />) },
  { path: 'integrations/jobs', element: withSuspense(<AdminIntegrationJobsPage />) },
  { path: 'integrations/conflicts', element: withSuspense(<AdminIntegrationConflictsPage />) },
  { path: 'integrations/:connectionId', element: withSuspense(<AdminIntegrationDetailPage />) },
  { path: 'security/audit', element: withSuspense(<AdminAuditPage />) },
  { path: 'security/sessions', element: withSuspense(<AdminSessionsPage />) },
  { path: 'profile', element: withSuspense(<ProfilePage />) },
  { path: 'users', element: <Navigate to="/dashboard/admin/team/users" replace /> },
  { path: 'requests', element: <Navigate to="/dashboard/admin/operations/requests" replace /> },
  { path: 'bookings', element: <Navigate to="/dashboard/admin/operations/bookings" replace /> },
  { path: 'content', element: <Navigate to="/dashboard/admin/site/items" replace /> },
  { path: 'appearance', element: <Navigate to="/dashboard/admin/site/appearance" replace /> },
  { path: 'audit', element: <Navigate to="/dashboard/admin/security/audit" replace /> },
  { path: '*', element: withSuspense(<DashboardNotFoundPage />) },
];

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
      { path: 'forgot-password', element: withSuspense(<ForgotPasswordPage />) },
      { path: 'reset-password', element: withSuspense(<ResetPasswordPage />) },
      { path: 'verify-email', element: withSuspense(<VerifyEmailPage />) },
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
    errorElement: withSuspense(<DashboardErrorPage />),
    element: (
      <ProtectedRoute>
        <DashboardLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <DashboardHomeRedirect /> },
      { path: 'profile', element: <DashboardProfileRedirect /> },
      {
        path: 'client',
        errorElement: withSuspense(<DashboardErrorPage />),
        element: <ClientZoneSection />,
        children: clientRoutes,
      },
      {
        path: 'manager',
        errorElement: withSuspense(<DashboardErrorPage />),
        element: <ManagerZoneSection />,
        children: managerRoutes,
      },
      {
        path: 'admin',
        errorElement: withSuspense(<DashboardErrorPage />),
        element: <RoleSection roles={['ADMINISTRATOR']} />,
        children: adminRoutes,
      },
      { path: '*', element: <DashboardHomeRedirect /> },
    ],
  },
]);

/** Guard-обёртка для целой зоны кабинета: роль проверяется один раз на секцию. */
function RoleSection({ roles }: { roles: UserRole[] }) {
  const outletContext = useOutletContext();
  return (
    <RoleRoute roles={roles}>
      <Outlet context={outletContext} />
    </RoleRoute>
  );
}

function withSuspense(element: ReactNode) {
  return <Suspense fallback={<PageSuspenseFallback />}>{element}</Suspense>;
}

function DashboardHomeRedirect() {
  const { user } = useAuth();
  return <Navigate to={dashboardHomeFor(user?.role)} replace />;
}

/**
 * Клиентский кабинет показывает данные текущего пользователя, поэтому сотрудник
 * увидел бы там пустой «свой» гараж вместо рабочего стола. Возвращаем его в свою зону.
 */
function ClientZoneSection() {
  const { user } = useAuth();
  const outletContext = useOutletContext();
  if (user && user.role !== 'CLIENT') {
    return <Navigate to={dashboardHomeFor(user.role)} replace />;
  }
  return (
    <RoleRoute roles={['CLIENT']}>
      <Outlet context={outletContext} />
    </RoleRoute>
  );
}

function ManagerZoneSection() {
  const { user } = useAuth();
  const location = useLocation();
  const outletContext = useOutletContext();
  if (user?.role === 'ADMINISTRATOR') {
    return <Navigate to={adminPathForManagerPath(location.pathname + location.search + location.hash)} replace />;
  }
  return (
    <RoleRoute roles={['MANAGER']}>
      <Outlet context={outletContext} />
    </RoleRoute>
  );
}

function DashboardProfileRedirect() {
  const { user } = useAuth();
  return <Navigate to={dashboardProfileFor(user?.role)} replace />;
}

function LegacyClientRequestRedirect() {
  const { requestId = '' } = useParams();
  return <Navigate to={`/dashboard/client/cases/${requestId}`} replace />;
}
