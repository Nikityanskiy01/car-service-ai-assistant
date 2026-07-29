import { describe, expect, it } from 'vitest';
import {
  activeConsultationStepIndex,
  consultationPhaseLabel,
  CONSULTATION_PHASE_STEPS,
} from './phaseLabels';

describe('phaseLabels', () => {
  it('maps known phases to Russian labels', () => {
    expect(consultationPhaseLabel('extracting')).toBe('Собираю данные');
    expect(consultationPhaseLabel('diagnosing')).toBe('Формирую план работ');
  });

  it('resolves active step index', () => {
    expect(activeConsultationStepIndex('extracting')).toBe(0);
    expect(activeConsultationStepIndex('analyzing_symptoms')).toBe(1);
    expect(activeConsultationStepIndex('diagnosing')).toBe(2);
  });

  it('defines three UX steps', () => {
    expect(CONSULTATION_PHASE_STEPS).toHaveLength(3);
  });
});
