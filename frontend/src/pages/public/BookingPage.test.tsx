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

const listVehiclesMock = vi.fn();

vi.mock('../../api/vehicles', () => ({
  listVehicles: (...args: unknown[]) => listVehiclesMock(...args),
  formatVehicleTitle: (vehicle: { make?: string; model?: string; year?: number | null }) =>
    [vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(' '),
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
  await userEvent.type(screen.getByRole('textbox', { name: /Имя/ }), 'Тестовый клиент');
  await userEvent.type(screen.getByRole('textbox', { name: /Телефон/ }), '+79990000000');
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
    listVehiclesMock.mockReset();
    navigateMock.mockReset();
    authState.user = null;
    authState.isAuthenticated = false;
    listRequestsMock.mockResolvedValue({ items: [] });
    listVehiclesMock.mockResolvedValue([]);
    sessionStorage.clear();
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

  it('binds garage vehicle from query and sends vehicleId', async () => {
    authState.isAuthenticated = true;
    authState.user = {
      id: '1',
      role: 'CLIENT',
      fullName: 'Иван',
      phone: '+79990000000',
      email: 'a@b.c',
    };
    listVehiclesMock.mockResolvedValue([
      { id: 'veh-duster', make: 'Renault', model: 'Duster', year: 2018, licensePlate: null },
    ]);
    apiMock.mockResolvedValue({ id: 'booking-car-1' });

    render(
      <MemoryRouter initialEntries={['/booking?vehicleId=veh-duster']}>
        <BookingPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText(/привязана к этому автомобилю/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Renault Duster/).length).toBeGreaterThan(0);

    await advanceClientWizardToSubmit();

    expect(apiMock).toHaveBeenCalledWith(
      '/bookings',
      expect.objectContaining({
        method: 'POST',
        body: expect.objectContaining({
          preferredAt: '2026-07-12T12:30',
          vehicleId: 'veh-duster',
        }),
      }),
    );
  });

  it('shows request number and topic when linking a booking to a case', async () => {
    authState.isAuthenticated = true;
    authState.user = {
      id: '1',
      role: 'CLIENT',
      fullName: 'Иван Петров',
      phone: '+79990000000',
      email: 'a@b.c',
    };
    listVehiclesMock.mockResolvedValue([
      { id: 'veh-duster', make: 'Renault', model: 'Duster', year: 2018, licensePlate: null },
    ]);
    listRequestsMock.mockResolvedValue({
      items: [
        {
          id: 'aaaabbbb-cccc-dddd-eeee-ffffffffffff',
          status: 'NEW',
          createdAt: '2026-08-12T10:00:00.000Z',
          snapshotMake: 'Hyundai',
          snapshotModel: 'Solaris',
          snapshotSymptoms: 'Скрип тормозов',
        },
      ],
    });

    render(
      <MemoryRouter initialEntries={['/booking?vehicleId=veh-duster']}>
        <BookingPage />
      </MemoryRouter>,
    );

    await userEvent.type(screen.getByLabelText('Предпочтительное время'), '2026-07-12T12:30');
    await userEvent.click(screen.getByRole('button', { name: 'Далее' }));
    await userEvent.click(screen.getByRole('button', { name: 'Далее' }));

    const select = await screen.findByLabelText(/Привязать к обращению/);
    expect(select).toHaveTextContent(/№AAAABBBB/);
    expect(select).toHaveTextContent(/Скрип тормозов/);
    expect(select).not.toHaveTextContent(/^Hyundai Solaris$/);

    await userEvent.selectOptions(select, 'aaaabbbb-cccc-dddd-eeee-ffffffffffff');
    expect(await screen.findByText(/Обращение №AAAABBBB/)).toBeInTheDocument();
    expect(screen.getByText(/Авто в заявке: Hyundai Solaris/)).toBeInTheDocument();
    expect(screen.getByText(/Запись на Renault Duster 2018 — это другое авто/)).toBeInTheDocument();
  });
});
