import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { RoleRoute } from './RoleRoute';
import { AuthProvider, useAuth } from './AuthProvider';
import { dashboardHomeFor } from '../config/dashboardPaths';

function stubUser(role: 'CLIENT' | 'MANAGER' | 'ADMINISTRATOR') {
  const user = { id: '1', role, email: 'a@b.c', fullName: 'Имя', phone: '+79990000000' };
  localStorage.setItem('car_service_user', JSON.stringify(user));
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify(user), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  );
}

function DashboardHomeRedirect() {
  const { user } = useAuth();
  return <Navigate to={dashboardHomeFor(user?.role)} replace />;
}

function renderWithAuth(ui: React.ReactNode, path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>{ui}</AuthProvider>
    </MemoryRouter>,
  );
}

describe('route guards', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('redirects unauthenticated to login from protected route', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401 })));
    renderWithAuth(
      <Routes>
        <Route path="/login" element={<div>login-page</div>} />
        <Route
          path="/secret"
          element={
            <ProtectedRoute>
              <div>secret</div>
            </ProtectedRoute>
          }
        />
      </Routes>,
      '/secret',
    );
    expect(await screen.findByText('login-page')).toBeInTheDocument();
  });

  it('shows forbidden redirect for wrong role', async () => {
    localStorage.setItem(
      'car_service_user',
      JSON.stringify({ id: '1', role: 'CLIENT', email: 'a', fullName: 'b', phone: 'c' }),
    );
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ id: '1', role: 'CLIENT', email: 'a', fullName: 'b', phone: 'c' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    );
    renderWithAuth(
      <Routes>
        <Route path="/403" element={<div>forbidden-page</div>} />
        <Route
          path="/admin"
          element={
            <RoleRoute roles={['ADMINISTRATOR']}>
              <div>admin</div>
            </RoleRoute>
          }
        />
      </Routes>,
      '/admin',
    );
    expect(await screen.findByText('forbidden-page')).toBeInTheDocument();
  });

  it('sends the dashboard index to the workspace of the current role', async () => {
    stubUser('MANAGER');
    renderWithAuth(
      <Routes>
        <Route path="/dashboard">
          <Route index element={<DashboardHomeRedirect />} />
          <Route path="client" element={<div>client-home</div>} />
          <Route path="manager" element={<div>manager-home</div>} />
        </Route>
      </Routes>,
      '/dashboard',
    );
    expect(await screen.findByText('manager-home')).toBeInTheDocument();
  });

  it('guards a whole section once and renders its nested pages', async () => {
    stubUser('MANAGER');
    renderWithAuth(
      <Routes>
        <Route path="/403" element={<div>forbidden-page</div>} />
        <Route
          path="/dashboard/manager"
          element={
            <RoleRoute roles={['MANAGER', 'ADMINISTRATOR']}>
              <Outlet />
            </RoleRoute>
          }
        >
          <Route index element={<div>manager-desk</div>} />
          <Route path="requests" element={<div>manager-requests</div>} />
        </Route>
      </Routes>,
      '/dashboard/manager/requests',
    );
    expect(await screen.findByText('manager-requests')).toBeInTheDocument();
  });

  it('blocks a client from the manager section', async () => {
    stubUser('CLIENT');
    renderWithAuth(
      <Routes>
        <Route path="/403" element={<div>forbidden-page</div>} />
        <Route
          path="/dashboard/manager"
          element={
            <RoleRoute roles={['MANAGER', 'ADMINISTRATOR']}>
              <Outlet />
            </RoleRoute>
          }
        >
          <Route index element={<div>manager-desk</div>} />
        </Route>
      </Routes>,
      '/dashboard/manager',
    );
    expect(await screen.findByText('forbidden-page')).toBeInTheDocument();
  });
});
