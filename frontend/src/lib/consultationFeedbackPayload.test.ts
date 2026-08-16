import { describe, expect, it } from 'vitest';
import { toFeedbackPayload } from './consultationFeedbackPayload';
import type { ConsultationFeedback } from '../types/serviceRequest';

const initial: ConsultationFeedback = {
  id: 'fb-1',
  verdict: 'PARTIAL',
  actualCause: 'Износ дисков',
  worksDone: 'Замена дисков',
  repairAmountMinor: 1_500_000,
  workOrderNumber: 'ЗН-0042',
  repairCompletedAt: '2026-08-10T00:00:00.000Z',
  repairMileageKm: 45200,
  workCategory: 'brakes',
  createdAt: '2026-08-10T10:00:00.000Z',
  updatedAt: '2026-08-10T10:00:00.000Z',
};

describe('toFeedbackPayload', () => {
  it('returns null without a verdict', () => {
    expect(toFeedbackPayload(null, { worksDone: 'Замена масла' })).toBeNull();
  });

  it('keeps repair fields when saving only a verdict', () => {
    const payload = toFeedbackPayload(initial, {
      verdict: 'CORRECT',
      actualCause: '',
    });

    expect(payload).toMatchObject({
      verdict: 'CORRECT',
      worksDone: 'Замена дисков',
      repairAmountMinor: 1_500_000,
      workOrderNumber: 'ЗН-0042',
      repairMileageKm: 45200,
      workCategory: 'brakes',
    });
  });

  it('keeps the existing verdict when saving only works', () => {
    const payload = toFeedbackPayload(initial, {
      worksDone: 'Замена колодок',
      repairAmountRub: '18000',
      workOrderNumber: 'ЗН-0099',
      repairCompletedAt: '2026-08-16',
      repairMileageKm: '46000',
      workCategory: 'brakes',
    });

    expect(payload?.verdict).toBe('PARTIAL');
    expect(payload?.actualCause).toBe('Износ дисков');
    expect(payload?.worksDone).toBe('Замена колодок');
    expect(payload?.repairAmountMinor).toBe(1_800_000);
    expect(payload?.workOrderNumber).toBe('ЗН-0099');
    expect(payload?.repairMileageKm).toBe(46000);
  });
});
