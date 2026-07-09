import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from './client';

describe('api client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    Object.defineProperty(document, 'cookie', { value: 'car_service_csrf=testtoken', configurable: true });
  });

  it('добавляет CSRF заголовок в mutating-запрос', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    await api('/contact', { method: 'POST', body: { fullName: 'A', phone: '+7' }, skipAuthRefresh: true });
    const [, req] = fetchMock.mock.calls[0];
    const headers = req.headers as Headers;
    expect(headers.get('X-CSRF-Token')).toBe('testtoken');
  });

  it('выполняет один refresh после 401 и повторяет запрос', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ user: { id: '1', role: 'CLIENT', email: 'client@example.local', fullName: 'U', phone: '+7' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ value: 42 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const data = await api<{ value: number }>('/users/me');
    expect(data.value).toBe(42);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1][0]).toBe('/api/auth/refresh');
  });
});
