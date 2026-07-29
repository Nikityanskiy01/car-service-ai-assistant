import { describe, expect, it } from '@jest/globals';
import { evaluateScenario, evaluatePromptContracts, runConsultationEval } from './evalRunner.js';

describe('consultation eval suite', () => {
  it('passes all rule-based scenarios', () => {
    const report = runConsultationEval();
    if (!report.ok) {
      throw new Error(JSON.stringify(report, null, 2));
    }
    expect(report.passed).toBeGreaterThanOrEqual(30);
  });

  it('prompt contracts stay stable', () => {
    const check = evaluatePromptContracts();
    expect(check.ok).toBe(true);
  });

  it('critical brake pedal scenario', () => {
    const out = evaluateScenario({
      id: 'smoke',
      input: {
        symptoms: 'педаль тормоза проваливается',
        conditions: 'тормозит хуже',
      },
      expect: { urgency: 'critical' },
    });
    expect(out.ok).toBe(true);
  });
});
