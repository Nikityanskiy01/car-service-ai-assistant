import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../../auth/AuthProvider';
import { AppRuntimeProvider } from '../../app/providers/AppRuntimeProvider';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { ConsultPage } from './ConsultPage';
import { STORAGE_KEYS } from '../../lib/storageKeys';

const streamStartMock = vi.fn();
const streamStopMock = vi.fn();

vi.mock('../../api/client', () => ({
  api: vi.fn(async (path: string) => {
    if (path === '/consultations') return { id: 'session-1', guestToken: 'guest-token-1' };
    if (path === '/consultations/session-1') return { id: 'session-1', status: 'ACTIVE', messages: [] };
    if (path === '/consultations/session-live') return { id: 'session-live', status: 'ACTIVE', messages: [] };
    return {};
  }),
  getCsrfToken: vi.fn(() => 'csrf'),
  getCachedUser: vi.fn(() => null),
  setCachedUser: vi.fn(),
  clearLocalAuthState: vi.fn(),
}));

vi.mock('../../features/consultations/useConsultationStream', () => ({
  useConsultationStream: () => ({
    start: streamStartMock,
    stop: streamStopMock,
  }),
}));

describe('consult page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    streamStartMock.mockImplementation(async ({ handlers }) => {
      handlers?.onDone?.({ id: 'session-1', status: 'ACTIVE', messages: [] });
    });
  });

  it('auto-boots session and renders chat form', async () => {
    render(
      <MemoryRouter>
        <ThemeProvider>
          <AppRuntimeProvider>
            <AuthProvider>
              <ConsultPage />
            </AuthProvider>
          </AppRuntimeProvider>
        </ThemeProvider>
      </MemoryRouter>,
    );
    expect(await screen.findByPlaceholderText(/Марка, модель, пробег/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Начать новую сессию/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Новая сессия/i })).toBeInTheDocument();
  });

  it('does not abort active stream on intermediate rerenders', async () => {
    sessionStorage.setItem(STORAGE_KEYS.consultSessionId, 'session-live');
    sessionStorage.setItem(STORAGE_KEYS.consultGuestToken, 'guest-token-live');

    streamStartMock.mockImplementation(async ({ handlers }) => {
      handlers?.onThinking?.({ phase: 'started' });
      handlers?.onProgress?.({ phase: 'extracting' });
      handlers?.onDone?.({ id: 'session-live', status: 'IN_PROGRESS', messages: [] });
    });

    render(
      <MemoryRouter>
        <ThemeProvider>
          <AppRuntimeProvider>
            <AuthProvider>
              <ConsultPage />
            </AuthProvider>
          </AppRuntimeProvider>
        </ThemeProvider>
      </MemoryRouter>,
    );

    await userEvent.type(
      await screen.findByPlaceholderText(/Марка, модель, пробег/i),
      'Вибрация при торможении на скорости',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Отправить' }));

    await waitFor(() => expect(streamStartMock).toHaveBeenCalledTimes(1));
    expect(streamStopMock).not.toHaveBeenCalled();
  });
});
