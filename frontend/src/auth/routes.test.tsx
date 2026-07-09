import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { RoleRoute } from './RoleRoute';
import { AuthProvider } from './AuthProvider';

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
});
