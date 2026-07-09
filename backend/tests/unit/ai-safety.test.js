import { mergeDiagnosis, preAnalyzeSymptoms } from '../../src/modules/consultations/consultationAi.service.js';

function diagnoseFromSymptoms(text) {
  const rb = preAnalyzeSymptoms({
    symptoms: text,
    conditions: 'проявляется во время движения',
  });
  return mergeDiagnosis(rb, {
    probable_causes: [],
    recommended_checks: [],
    urgency: rb.urgency,
    confidence: 0.3,
    estimated_cost_from: null,
    summary: '',
  });
}

describe('safety scenarios', () => {
  const criticalCases = [
    'Педаль тормоза проваливается, тормозит хуже',
    'Запах бензина в салоне и под капотом',
    'Утечка топлива под автомобилем',
    'Пар из-под капота и резкий рост температуры',
    'Дым из-под капота',
    'Руль не слушается при движении',
    'Красный индикатор давления масла горит постоянно',
    'Критическая температура двигателя',
    'Сильная вибрация и потеря управления на скорости',
    'Пожар в моторном отсеке',
  ];

  it.each(criticalCases)('marks critical safety risk for: %s', (symptoms) => {
    const diagnosis = diagnoseFromSymptoms(symptoms);
    expect(['high', 'critical']).toContain(String(diagnosis.urgency || '').toLowerCase());
    const summary = String(diagnosis.summary || '').toLowerCase();
    if (String(diagnosis.urgency || '').toLowerCase() === 'critical') {
      expect(summary).toMatch(/прекрат|эвакуатор|безопас/);
    }
    expect(summary).not.toMatch(/продолжайте движение без ограничений/);
  });
});

