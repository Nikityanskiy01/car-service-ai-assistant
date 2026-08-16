import { describe, expect, it } from 'vitest';
import { resolveCaseNextStep } from './resolveCaseNextStep';

describe('resolveCaseNextStep', () => {
  it('guides draft to continue diagnosis', () => {
    const step = resolveCaseNextStep({ isDraft: true, consultationStatus: 'IN_PROGRESS' });
    expect(step.primary.action).toBe('continue_diagnosis');
    expect(step.tone).toBe('draft');
    expect(step.secondary).toBeUndefined();
  });

  it('offers booking for new request without visit', () => {
    const step = resolveCaseNextStep({
      isDraft: false,
      requestStatus: 'NEW',
      requestId: 'req-1',
    });
    expect(step.primary.action).toBe('book_visit');
    expect(step.secondary?.action).toBe('write_message');
  });

  it('keeps PENDING visit as requested, not planned', () => {
    const step = resolveCaseNextStep({
      isDraft: false,
      requestStatus: 'NEW',
      requestId: 'req-1',
      bookingId: 'b-1',
      bookingPreferredAt: '2026-07-31T01:14:00.000Z',
      bookingStatus: 'PENDING',
    });
    expect(step.nowLabel).toMatch(/Нужно согласовать/);
    expect(step.yourStepLabel).toMatch(/соглас/);
    expect(step.tone).toBe('waiting');
    expect(step.primary.action).toBe('open_visit');
  });

  it('uses confirmed copy for CONFIRMED booking', () => {
    const step = resolveCaseNextStep({
      isDraft: false,
      requestStatus: 'NEW',
      requestId: 'req-1',
      bookingId: 'b-1',
      bookingPreferredAt: '2026-07-31T01:14:00.000Z',
      bookingStatus: 'CONFIRMED',
    });
    expect(step.nowLabel).toMatch(/Запись подтверждена/);
    expect(step.tone).toBe('visit');
  });

  it('treats SCHEDULED request as confirmed visit', () => {
    const step = resolveCaseNextStep({
      isDraft: false,
      requestStatus: 'SCHEDULED',
      requestId: 'req-1',
      bookingId: 'b-1',
    });
    expect(step.nowLabel).toMatch(/Запись подтверждена/);
    expect(step.primary.action).toBe('open_visit');
  });
});
