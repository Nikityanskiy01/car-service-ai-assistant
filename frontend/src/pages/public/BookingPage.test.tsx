import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { BookingPage } from './BookingPage';

const apiMock = vi.fn();
const listRequestsMock = vi.fn();
const navigateMock = vi.fn();
const authState = vi.hoisted(() => ({
  user: null as null | { id: string; role: string; fullName: string; phone: string; email: string },
  isAuthenticated: false,
}));

vi.mock('../../api/client', () => ({
  api: (...args: unknown[]) => apiMock(...args),
}));

vi.mock('../../api/dashboard', () => ({
  listServiceRequests: (...args: unknown[]) => listRequestsMock(...args),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('../../auth/AuthProvider', () => ({
  useAuth: () => ({
    user: authState.user,
    isAuthenticated: authState.isAuthenticated,
  }),
}));

async function advanceGuestWizardToSubmit() {
  await userEvent.type(screen.getByLabelText('Предпочтительное время'), '2026-07-12T12:30');
  await userEvent.click(screen.getByRole('button', { name: 'Далее' }));
  await userEvent.type(screen.getByLabelText('Имя'), 'Тестовый клиент');
  await userEvent.type(screen.getByLabelText('Телефон'), '+79990000000');
  await userEvent.click(screen.getByRole('button', { name: 'Далее' }));
  await userEvent.click(screen.getByRole('button', { name: 'Далее' }));
  await userEvent.click(screen.getByRole('checkbox'));
  await userEvent.click(screen.getByRole('button', { name: 'Отправить заявку' }));
}

async function advanceClientWizardToSubmit() {
  await userEvent.type(screen.getByLabelText('Предпочтительное время'), '2026-07-12T12:30');
  await userEvent.click(screen.getByRole('button', { name: 'Далее' }));
  await userEvent.click(screen.getByRole('button', { name: 'Далее' }));
  await userEvent.click(screen.getByRole('button', { name: 'Далее' }));
  await userEvent.click(screen.getByRole('checkbox'));
  await userEvent.click(screen.getByRole('button', { name: 'Отправить заявку' }));
}

describe('booking page', () => {
  beforeEach(() => {
    apiMock.mockReset();
    listRequestsMock.mockReset();
    navigateMock.mockReset();
    authState.user = null;
    authState.isAuthenticated = false;
    listRequestsMock.mockResolvedValue({ items: [] });
  });

  it('creates guest booking request via wizard', async () => {
    apiMock.mockResolvedValue({ id: 'booking-1' });
    render(
      <MemoryRouter>
        <BookingPage />
      </MemoryRouter>,
    );
    await advanceGuestWizardToSubmit();
    expect(await screen.findByText(/Запись отправлена/i)).toBeInTheDocument();
    expect(apiMock).toHaveBeenCalledWith('/bookings/guest', expect.objectContaining({ method: 'POST' }));
  });

  it('creates authenticated client booking and redirects to detail', async () => {
    authState.isAuthenticated = true;
    authState.user = {
      id: '1',
      role: 'CLIENT',
      fullName: 'Иван',
      phone: '+79990000000',
      email: 'a@b.c',
    };
    apiMock.mockResolvedValue({ id: 'booking-auth-1' });

    render(
      <MemoryRouter>
        <BookingPage />
      </MemoryRouter>,
    );

    await advanceClientWizardToSubmit();

    expect(apiMock).toHaveBeenCalledWith(
      '/bookings',
      expect.objectContaining({
        method: 'POST',
        body: expect.objectContaining({ preferredAt: '2026-07-12T12:30' }),
      }),
    );
    expect(navigateMock).toHaveBeenCalledWith('/dashboard/client/bookings/booking-auth-1', {
      replace: true,
    });
  });
});
