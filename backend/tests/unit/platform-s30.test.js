import { encodeCursor, decodeCursor, nextCursorFromPage } from '../../src/lib/cursorPage.ts';
import { getAdapter, listRegisteredProviders } from '../../src/modules/integrations/integrationRegistry.service.ts';

describe('cursorPage', () => {
  test('roundtrip', () => {
    const raw = encodeCursor({ id: 'abc', t: '2026-08-16T00:00:00.000Z' });
    expect(decodeCursor(raw)).toEqual({ id: 'abc', t: '2026-08-16T00:00:00.000Z' });
  });

  test('next cursor when page is full', () => {
    const items = [
      { id: '1', updatedAt: new Date('2026-01-01T00:00:00Z') },
      { id: '2', updatedAt: new Date('2026-01-02T00:00:00Z') },
    ];
    const next = nextCursorFromPage(items, {
      limit: 2,
      getCursor: (row) => ({ id: row.id, t: row.updatedAt.toISOString() }),
    });
    expect(decodeCursor(next)?.id).toBe('2');
  });

  test('no next cursor on short page', () => {
    expect(nextCursorFromPage([{ id: '1', updatedAt: new Date() }], { limit: 2, getCursor: (r) => ({ id: r.id, t: r.updatedAt.toISOString() }) })).toBeNull();
  });
});

describe('integration registry', () => {
  test('registers all 12 providers from enum', () => {
    const names = listRegisteredProviders();
    expect(names).toEqual(
      expect.arrayContaining([
        'GENERIC_REST',
        'ONE_C',
        'BITRIX24',
        'MOYSKLAD',
        'GENERIC_WEBHOOK',
        'AMOCRM',
        'YCLIENTS',
        'MEGAPLAN',
        'AUTODEALER_WEB',
        'AUTODEALER_ONLINE',
        'AUTODEALER_DESKTOP',
        'FILE_EXCHANGE',
      ]),
    );
    expect(names).toHaveLength(12);
  });

  test('Bitrix24 requires webhook URL', async () => {
    const adapter = getAdapter('BITRIX24');
    const bad = await adapter.validateConfiguration({});
    expect(bad.ok).toBe(false);
    const ok = await adapter.validateConfiguration({ baseUrl: 'https://example.bitrix24.ru/rest/1/hook/' });
    expect(ok.ok).toBe(true);
  });

  test('MoySklad requires token', async () => {
    const adapter = getAdapter('MOYSKLAD');
    const bad = await adapter.validateConfiguration({ baseUrl: 'https://api.moysklad.ru/api/remap/1.2' });
    expect(bad.ok).toBe(false);
    const ok = await adapter.validateConfiguration({
      baseUrl: 'https://api.moysklad.ru/api/remap/1.2',
      token: 'secret-token',
    });
    expect(ok.ok).toBe(true);
  });

  test('AmoCRM requires URL and token', async () => {
    const adapter = getAdapter('AMOCRM');
    const bad = await adapter.validateConfiguration({});
    expect(bad.ok).toBe(false);
    const ok = await adapter.validateConfiguration({
      baseUrl: 'https://example.amocrm.ru',
      token: 'secret-token',
    });
    expect(ok.ok).toBe(true);
  });

  test('YCLIENTS requires token and companyId', async () => {
    const adapter = getAdapter('YCLIENTS');
    const bad = await adapter.validateConfiguration({ token: 'x' });
    expect(bad.ok).toBe(false);
    const ok = await adapter.validateConfiguration({
      token: 'partner-token',
      companyId: '123',
    });
    expect(ok.ok).toBe(true);
  });

  test('FILE_EXCHANGE requires HTTPS drop URL', async () => {
    const adapter = getAdapter('FILE_EXCHANGE');
    const bad = await adapter.validateConfiguration({ format: 'csv' });
    expect(bad.ok).toBe(false);
    const ok = await adapter.validateConfiguration({
      webhookUrl: 'https://exchange.example.com/drop',
      format: 'csv',
    });
    expect(ok.ok).toBe(true);
  });
});
