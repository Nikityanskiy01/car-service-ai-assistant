import { describe, expect, it } from '@jest/globals';
import { runDiagnosisAgent } from '../../src/services/diagnosisAgent.service.js';

const testEnv = {
  LLM_DIAGNOSIS_MODEL: 'gpt-4.1-mini',
  LLM_MODEL: 'gpt-4.1-mini',
  LLM_KEEP_ALIVE: '30m',
  DIAGNOSIS_AGENT_TIMEOUT_MS: 15000,
  DIAGNOSIS_AGENT_MAX_RETRIES: 1,
};

describe('runDiagnosisAgent', () => {
  it('проходит 4 шага и возвращает контракт диагноза', async () => {
    let call = 0;
    const invokeCompletion = async () => {
      call++;
      if (call === 1) {
        return JSON.stringify({
          normalized_symptoms: 'перегрев двигателя',
          normalized_conditions: 'в пробке',
          inferred_intent: 'diagnostic',
          key_signals: ['перегрев', 'в пробке'],
          missing_data: [],
        });
      }
      if (call === 2) {
        return JSON.stringify({
          probable_causes: ['Термостат', 'Радиатор'],
          urgency: 'high',
          confidence: 0.81,
          rationale: 'match_signals',
        });
      }
      if (call === 3) {
        return JSON.stringify({
          recommended_checks: ['Проверка термостата', 'Проверка работы вентилятора'],
          estimated_cost_from: 3500,
          work_scope: ['Система охлаждения'],
        });
      }
      return JSON.stringify({
        probable_causes: ['Термостат', 'Радиатор'],
        recommended_checks: ['Проверка термостата', 'Проверка работы вентилятора'],
        urgency: 'high',
        confidence: 0.86,
        estimated_cost_from: 3500,
        summary: 'Вероятен перегрев из-за некорректной работы системы охлаждения.',
      });
    };

    const out = await runDiagnosisAgent({
      payload: { symptoms: 'греется двигатель', conditions: 'в пробке' },
      relatedCases: [],
      playbook: null,
      topWorks: [],
      env: testEnv,
      invokeCompletion,
      logger: { info: () => {}, warn: () => {} },
    });

    expect(out.diagnosis.urgency).toBe('high');
    expect(out.diagnosis.probable_causes.length).toBeGreaterThan(0);
    expect(out.diagnosis.recommended_checks.length).toBeGreaterThan(0);
    expect(out.diagnosis.estimated_cost_from).toBe(3500);
  });

  it('делает fallback финального шага при сбое synthesis', async () => {
    let call = 0;
    const invokeCompletion = async () => {
      call++;
      if (call === 1) {
        return JSON.stringify({
          normalized_symptoms: 'плавают обороты',
          normalized_conditions: null,
          inferred_intent: 'diagnostic',
          key_signals: ['плавают обороты'],
          missing_data: ['conditions'],
        });
      }
      if (call === 2) {
        return JSON.stringify({
          probable_causes: ['Подсос воздуха'],
          urgency: 'medium',
          confidence: 0.62,
          rationale: 'rpm_instability',
        });
      }
      if (call === 3) {
        return JSON.stringify({
          recommended_checks: ['Проверка подсоса воздуха'],
          estimated_cost_from: 2500,
          work_scope: ['Впуск'],
        });
      }
      throw new Error('llm_unavailable');
    };

    const out = await runDiagnosisAgent({
      payload: { symptoms: 'плавают обороты' },
      env: testEnv,
      invokeCompletion,
      logger: { info: () => {}, warn: () => {} },
    });

    expect(out.diagnosis.probable_causes.length).toBeGreaterThan(0);
    expect(out.diagnosis.recommended_checks.length).toBeGreaterThan(0);
    expect(out.diagnosis.summary.toLowerCase()).toContain('предварительный');
  });
});
