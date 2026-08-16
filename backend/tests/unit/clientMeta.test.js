import {
  deviceSessionKey,
  formatClientIp,
  isScriptUserAgent,
  parseUserAgent,
} from '../../src/lib/clientMeta.js';

describe('clientMeta', () => {
  it('does not call localhost "this device"', () => {
    expect(formatClientIp('127.0.0.1')).toEqual({
      display: 'Локальный адрес',
      kind: 'local',
      raw: '127.0.0.1',
    });
    expect(formatClientIp('::ffff:172.18.0.1')).toMatchObject({
      display: 'Локальная сеть',
      kind: 'private',
      raw: '172.18.0.1',
    });
  });

  it('labels scripts without treating superagent as a bot', () => {
    expect(parseUserAgent('node').isBot).toBe(true);
    expect(parseUserAgent('node').label).toBe('Скрипт · Node.js');
    expect(parseUserAgent('curl/8.5.0').label).toBe('Скрипт · curl 8.5.0');
    expect(isScriptUserAgent('node-superagent/9.0.0')).toBe(false);
    expect(parseUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X) Chrome/120.0.0.0').label).toMatch(
      /Chrome/,
    );
  });

  it('fingerprints the same device across ipv4-mapped addresses', () => {
    const ua = 'Mozilla/5.0 Chrome/120';
    expect(deviceSessionKey('::ffff:176.115.32.205', ua)).toBe(deviceSessionKey('176.115.32.205', ua));
  });
});
