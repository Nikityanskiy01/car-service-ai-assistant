import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { LoginPage } from './LoginPage';
import { RegisterPage } from './RegisterPage';
import { VerifyEmailPage } from './VerifyEmailPage';
import { AuthProvider } from '../../auth/AuthProvider';
import { STORAGE_KEYS } from '../../lib/storageKeys';
import { api } from '../../api/client';

vi.mock('../../api/client', async () => {
  return {
    api: vi.fn(async (path: string, options?: { body?: Record<string, unknown> }) => {
      if (path === '/auth/login') {
        return { user: { id: '1', role: 'CLIENT', email: 'x', fullName: 'y', phone: 'z' } };
      }
      if (path === '/auth/login-options') {
        return {
          password: true,
          emailOtp: true,
          sms: { configured: false },
          telegram: { configured: true, botUsername: 'autoservice_auth_bot' },
        };
      }
      if (path === '/auth/otp/start') {
        return {
          challengeToken: 'otp-challenge-token',
          channel: options?.body?.channel,
          destinationHint: options?.body?.channel === 'email' ? 'c***@example.local' : 'Telegram',
          expiresInSec: 600,
          resendAfterSec: 60,
        };
      }
      if (path === '/auth/register') {
        return {
          requiresEmailVerification: true,
          message: 'Код отправлен на почту',
          email: 'c***@example.local',
        };
      }
      if (path === '/auth/verify-email') {
        return { user: { id: '2', role: 'CLIENT', email: 'x', fullName: 'y', phone: 'z' } };
      }
      if (path.startsWith('/consultations/') && path.endsWith('/claim')) {
        return { id: 'session-1' };
      }
      if (path === '/users/me') {
        throw new Error('unauthorized');
      }
      return {};
    }),
    clearLocalAuthState: vi.fn(),
    getCachedUser: vi.fn(() => null),
    setCachedUser: vi.fn(),
    getCsrfToken: vi.fn(() => ''),
  };
});

function wrap(node: React.ReactNode) {
  return (
    <MemoryRouter>
      <AuthProvider>{node}</AuthProvider>
    </MemoryRouter>
  );
}

function wrapRegisterFlow() {
  return (
    <MemoryRouter initialEntries={['/register']}>
      <AuthProvider>
        <Routes>
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('auth forms', () => {
  beforeEach(() => {
    vi.mocked(api).mockClear();
  });

  it('submits login form', async () => {
    render(wrap(<LoginPage />));
    await userEvent.type(screen.getByLabelText('Телефон или почта'), 'client@example.local');
    await userEvent.type(screen.getByLabelText('Пароль'), 'Password123!ab');
    await userEvent.click(screen.getByRole('button', { name: 'Войти' }));
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith(
        '/auth/login',
        expect.objectContaining({
          body: { identifier: 'client@example.local', password: 'Password123!ab' },
        }),
      ),
    );
  });

  it('submits register form and opens email verification', async () => {
    render(wrapRegisterFlow());
    await userEvent.type(screen.getByLabelText(/ФИО/), 'Тестовый клиент');
    await userEvent.type(screen.getByLabelText(/Телефон/), '+79990000000');
    await userEvent.type(screen.getByLabelText(/Email/), 'client@example.local');
    await userEvent.type(screen.getByLabelText(/^Пароль/), 'Password123!ab');
    await userEvent.type(screen.getByLabelText(/Подтверждение пароля/), 'Password123!ab');
    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: 'Создать аккаунт' }));
    expect(await screen.findByRole('heading', { name: 'Подтвердите email' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Код из письма/)).toBeInTheDocument();
  });

  it('claims guest consultation after login when session is stored', async () => {
    sessionStorage.setItem(STORAGE_KEYS.consultSessionId, 'session-1');
    sessionStorage.setItem(STORAGE_KEYS.consultGuestToken, 'guest-token-1234567890');
    render(wrap(<LoginPage />));
    await userEvent.type(screen.getByLabelText('Телефон или почта'), 'client@example.local');
    await userEvent.type(screen.getByLabelText('Пароль'), 'Password123!ab');
    await userEvent.click(screen.getByRole('button', { name: 'Войти' }));
    await waitFor(() => expect(sessionStorage.getItem(STORAGE_KEYS.consultGuestToken)).toBeNull());
  });

  it('opens with unified phone or email login', async () => {
    render(wrap(<LoginPage />));
    expect(screen.getByLabelText('Телефон или почта')).toBeInTheDocument();
    expect(screen.getByLabelText('Пароль')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Войти по коду' })).toBeInTheDocument();
  });

  it('routes code login by identifier type', async () => {
    const user = userEvent.setup();
    const { unmount } = render(wrap(<LoginPage />));
    await user.type(screen.getByLabelText('Телефон или почта'), 'client@example.local');
    await user.click(screen.getByRole('button', { name: 'Войти по коду' }));
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith(
        '/auth/otp/start',
        expect.objectContaining({ body: { channel: 'email', email: 'client@example.local' } }),
      ),
    );

    unmount();
    vi.mocked(api).mockClear();
    render(wrap(<LoginPage />));
    await user.type(screen.getByLabelText('Телефон или почта'), '+7 999 000-11-22');
    await user.click(screen.getByRole('button', { name: 'Войти по коду' }));
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith(
        '/auth/otp/start',
        expect.objectContaining({ body: { channel: 'telegram', phone: '+7 999 000-11-22' } }),
      ),
    );
  });
});
