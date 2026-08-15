export const URGENCY_RANK = { low: 1, medium: 2, high: 3, critical: 4 };

const GENERIC_CAUSE_BLOCKLIST = [
  'требуется очная проверка',
  'рекомендуется провести диагностику',
  'необходимо обратиться в сервис',
  'возможны различные причины',
];

export function safeDiagnosisFallback() {
  return {
    probable_causes: [],
    recommended_checks: [],
    urgency: 'medium',
    confidence: 0,
    estimated_cost_from: null,
    summary:
      'Интеллектуальный анализ временно недоступен. Введённые данные сохранены. Вы можете повторить анализ или передать обращение менеджеру для ручной обработки.',
    status: 'MANUAL_REVIEW_REQUIRED',
    analysis_available: false,
    reason: 'LLM_UNAVAILABLE',
    disclaimer: 'Результат предварительный и не заменяет техническую диагностику автомобиля специалистом.',
  };
}

export function isGenericDiagnosisText(text) {
  const s = String(text || '').toLowerCase().trim();
  if (!s) return true;
  return (
    s.includes('требуется очная проверка') ||
    s.includes('требуется дополнительная диагностика') ||
    s.includes('невозможно сделать') ||
    s.includes('обратитесь в сервис')
  );
}

export function isManualStatus(value) {
  return String(value || '').toUpperCase() === 'MANUAL_REVIEW_REQUIRED';
}

export function maxUrgency(a, b) {
  const ra = a in URGENCY_RANK ? URGENCY_RANK[a] : 1;
  const rb = b in URGENCY_RANK ? URGENCY_RANK[b] : 1;
  const va = a in URGENCY_RANK ? a : 'low';
  const vb = b in URGENCY_RANK ? b : 'low';
  return ra >= rb ? va : vb;
}

export function validateDiagnosisQuality(result) {
  /** @type {string[]} */
  const issues = [];
  const summary = String(result?.summary || '').trim();
  const causes = Array.isArray(result?.probable_causes) ? result.probable_causes : [];
  const checks = Array.isArray(result?.recommended_checks) ? result.recommended_checks : [];
  if (summary.length < 40) issues.push('summary_too_short');
  if (causes.length < 2) issues.push('too_few_causes');
  if (checks.length < 2) issues.push('too_few_checks');
  const firstCause = String(causes[0] || '').trim().toLowerCase();
  if (firstCause && firstCause === summary.toLowerCase()) issues.push('summary_equals_cause');
  if (causes.some((x) => GENERIC_CAUSE_BLOCKLIST.some((m) => String(x).toLowerCase().includes(m)))) {
    issues.push('generic_cause_detected');
  }
  const conf = Number(result?.confidence);
  if (!Number.isFinite(conf) || conf < 0 || conf > 1) issues.push('confidence_out_of_range');
  return { valid: issues.length === 0, issues };
}

export function buildManualReviewDiagnosis({ reason, executionMeta, ruleBased }) {
  const rb = ruleBased || {};
  const urgency = ['low', 'medium', 'high', 'critical'].includes(String(rb.urgency || ''))
    ? String(rb.urgency)
    : 'medium';
  const topChecks = Array.isArray(rb.recommended_checks) ? rb.recommended_checks.slice(0, 2) : [];
  let summary =
    'Интеллектуальный анализ временно недоступен. Введённые данные сохранены. Вы можете повторить анализ или передать обращение менеджеру для ручной обработки.';
  if (urgency === 'critical') {
    summary =
      'Обнаружены признаки потенциально опасной неисправности. Рекомендуется прекратить эксплуатацию автомобиля и организовать эвакуацию в сервис. ' +
      summary;
  } else if (urgency === 'high') {
    summary =
      'По симптомам требуется приоритетная проверка автомобиля в ближайшее время. ' +
      summary;
  }
  if (topChecks.length) {
    summary += ` Рекомендуемые первичные проверки: ${topChecks.join('; ')}.`;
  }
  return {
    ...safeDiagnosisFallback(),
    probable_causes: Array.isArray(rb.probable_causes) ? rb.probable_causes.slice(0, 5) : [],
    recommended_checks: Array.isArray(rb.recommended_checks) ? rb.recommended_checks.slice(0, 5) : [],
    urgency,
    reason: reason || 'LLM_UNAVAILABLE',
    execution_meta: executionMeta || null,
    summary,
  };
}
