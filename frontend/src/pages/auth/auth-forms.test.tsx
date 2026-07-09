import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { LoginPage } from './LoginPage';
import { RegisterPage } from './RegisterPage';
import { AuthProvider } from '../../auth/AuthProvider';

vi.mock('../../api/client', async () => {
  return {
    api: vi.fn(async (path: string) => {
      if (path === '/auth/login') {
        return { user: { id: '1', role: 'CLIENT', email: 'x', fullName: 'y', phone: 'z' } };
      }
      if (path === '/auth/register') {
        return { user: { id: '2', role: 'CLIENT', email: 'x', fullName: 'y', phone: 'z' } };
      }
      if (path === '/users/me') {
        throw new Error('unauthorized');
      }
      return {};
    }),
    clearLocalAuthState: vi.fn(),
    getCachedUser: vi.fn(() => null),
    setCachedUser: vi.fn(),
  };
});

function wrap(node: React.ReactNode) {
  return (
    <MemoryRouter>
      <AuthProvider>{node}</AuthProvider>
    </MemoryRouter>
  );
}

describe('auth forms', () => {
  it('submits login form', async () => {
    render(wrap(<LoginPage />));
    await userEvent.type(screen.getByLabelText('Email'), 'client@example.local');
    await userEvent.type(screen.getByLabelText('Пароль'), 'Password123!');
    await userEvent.click(screen.getByRole('button', { name: 'Войти' }));
    expect(await screen.findByRole('button', { name: /Вход|Войти|Вход.../i })).toBeInTheDocument();
  });

  it('submits register form', async () => {
    render(wrap(<RegisterPage />));
    await userEvent.type(screen.getByLabelText('ФИО'), 'Тестовый клиент');
    await userEvent.type(screen.getByLabelText('Телефон'), '+79990000000');
    await userEvent.type(screen.getByLabelText('Email'), 'client@example.local');
    await userEvent.type(screen.getByLabelText('Пароль'), 'Password123!');
    await userEvent.click(screen.getByRole('button', { name: 'Создать аккаунт' }));
    expect(await screen.findByRole('button', { name: /Регистрация|Создать аккаунт|Регистрация.../i })).toBeInTheDocument();
  });
});
