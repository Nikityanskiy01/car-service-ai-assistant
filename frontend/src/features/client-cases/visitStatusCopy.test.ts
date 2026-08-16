import { describe, expect, it } from 'vitest';
import { visitStatusHeadline, visitTimelineDetail } from './visitStatusCopy';

describe('visitStatusCopy', () => {
  it('distinguishes requested vs confirmed headlines', () => {
    expect(visitStatusHeadline('PENDING', '31 июл., 01:14')).toBe('Нужно согласовать · 31 июл., 01:14');
    expect(visitStatusHeadline('CONFIRMED', '31 июл., 01:14')).toBe('Запись подтверждена · 31 июл., 01:14');
  });

  it('writes timeline detail without calling PENDING planned', () => {
    expect(visitTimelineDetail('PENDING', '31 июл., 01:14')).toMatch(/соглас/);
    expect(visitTimelineDetail('PENDING', '31 июл., 01:14')).toMatch(/подтверд/);
    expect(visitTimelineDetail('CONFIRMED', '31 июл., 01:14')).toMatch(/Подтверждён/);
  });
});
