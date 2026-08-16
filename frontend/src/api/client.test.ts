import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api, getCachedUser, setCachedUser } from './client';

describe('api client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
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

  it('не сбрасывает сессию, если refresh временно недоступен', async () => {
    setCachedUser({
      id: 'u1',
      role: 'CLIENT',
      email: 'client@example.local',
      fullName: 'U',
      phone: '+7',
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'rate limited', code: 'RATE_LIMITED' }), {
          status: 429,
          headers: { 'Content-Type': 'application/json', 'Retry-After': '30' },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(api('/users/me')).rejects.toMatchObject({ status: 401 });
    expect(getCachedUser()?.id).toBe('u1');
  });

  it('keeps only id and role in sessionStorage and clears localStorage', () => {
    localStorage.setItem('car_service_user', JSON.stringify({ id: 'legacy', email: 'pwn@t.test', role: 'CLIENT' }));
    setCachedUser({
      id: 'u1',
      role: 'CLIENT',
      email: 'secret@t.test',
      fullName: 'Иван',
      phone: '+79990000000',
    });
    expect(localStorage.getItem('car_service_user')).toBeNull();
    const stored = JSON.parse(String(sessionStorage.getItem('car_service_user')));
    expect(stored).toEqual({ id: 'u1', role: 'CLIENT' });
    expect(JSON.stringify(stored)).not.toMatch(/secret@t.test|Иван|7999/);
    const cached = getCachedUser();
    expect(cached?.id).toBe('u1');
    expect(cached?.role).toBe('CLIENT');
    expect(cached?.email).toBe('');
  });
});
