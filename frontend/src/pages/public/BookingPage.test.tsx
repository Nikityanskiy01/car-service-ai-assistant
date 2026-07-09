import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BookingPage } from './BookingPage';

vi.mock('../../api/client', () => ({
  api: vi.fn(async () => ({ ok: true })),
}));

describe('booking page', () => {
  it('creates guest booking request', async () => {
    render(<BookingPage />);
    await userEvent.type(screen.getByLabelText('Имя'), 'Тестовый клиент');
    await userEvent.type(screen.getByLabelText('Телефон'), '+79990000000');
    await userEvent.type(screen.getByLabelText('Предпочтительное время'), '2026-07-12T12:30');
    await userEvent.click(screen.getByRole('button', { name: 'Отправить заявку' }));
    expect(await screen.findByText(/Запись отправлена/i)).toBeInTheDocument();
  });
});
