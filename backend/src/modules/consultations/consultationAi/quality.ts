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
  /** @type */
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

function dedupeLines(items) {
  const seen = new Set();
  const out = [];
  for (const raw of items || []) {
    const s = String(raw || '').trim();
    if (!s) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

/**
 * Если LLM недоступна, отдаём плейбук + правила как полноценный предварительный разбор,
 * а не экран «анализ недоступен».
 */
export function formatDiagnosisChatMessage(diagnosis) {
  if (!diagnosis || typeof diagnosis !== 'object') {
    return 'Предварительный разбор готов. Можно сохранить отчёт и оформить заявку в сервис.';
  }
  const summary = String(diagnosis.summary || '').trim();
  if (diagnosis.analysis_available === false || isManualStatus(diagnosis.status)) {
    return summary || 'Автоматический анализ сейчас недоступен. Можно передать обращение менеджеру.';
  }
  const causes = Array.isArray(diagnosis.probable_causes)
    ? diagnosis.probable_causes.map((x) => String(x).trim()).filter(Boolean).slice(0, 5)
    : [];
  const checks = Array.isArray(diagnosis.recommended_checks)
    ? diagnosis.recommended_checks.map((x) => String(x).trim()).filter(Boolean).slice(0, 5)
    : [];
  const lines = [];
  if (summary) lines.push(summary);
  if (causes.length) {
    lines.push('', 'Наиболее вероятные причины:');
    causes.forEach((cause, i) => lines.push(`${i + 1}. ${cause}`));
  }
  if (checks.length) {
    lines.push('', 'Что проверим на посту:');
    checks.forEach((check) => lines.push(`• ${check}`));
  }
  lines.push('', 'Это предварительный ориентир, не окончательный диагноз. Можно сохранить отчёт и оформить заявку.');
  return lines.join('\n').trim();
}

export function buildPlaybookFallbackDiagnosis({ reason, executionMeta, ruleBased, playbook, payload, estimatedCost }: any) {
  const rb = ruleBased || {};
  const causes = dedupeLines([...(rb.probable_causes || []), ...(playbook?.hypotheses || [])]).slice(0, 5);
  const checks = dedupeLines([...(rb.recommended_checks || []), ...(playbook?.checks || [])]).slice(0, 5);
  if (causes.length < 2 || checks.length < 2) {
    return buildManualReviewDiagnosis({ reason, executionMeta, ruleBased });
  }

  const text = `${payload?.symptoms || ''} ${payload?.conditions || payload?.problemConditions || ''}`;
  let urgency = ['low', 'medium', 'high', 'critical'].includes(String(rb.urgency || ''))
    ? String(rb.urgency)
    : 'medium';
  const low = text.toLowerCase();
  if (playbook?.urgency?.now?.some((k) => low.includes(String(k).toLowerCase()))) urgency = maxUrgency(urgency, 'critical');
  else if (playbook?.urgency?.soon?.some((k) => low.includes(String(k).toLowerCase()))) {
    urgency = maxUrgency(urgency, 'high');
  }

  const vehicle = [payload?.car_make, payload?.car_model].filter(Boolean).join(' ');
  const topic = playbook?.title || 'предварительный разбор по симптомам';
  let summary = vehicle
    ? `По ${vehicle} предварительный ориентир — ${topic.toLowerCase()}. Наиболее вероятны: ${causes.slice(0, 3).join('; ')}. На посту начнём с указанных проверок, затем подтвердим объём работ.`
    : `Предварительный ориентир — ${topic.toLowerCase()}. Наиболее вероятны: ${causes.slice(0, 3).join('; ')}. На посту начнём с указанных проверок, затем подтвердим объём работ.`;
  if (urgency === 'critical') {
    summary =
      'Возможна критическая неисправность. Рекомендуется прекратить эксплуатацию автомобиля и организовать доставку в сервис эвакуатором. ' +
      summary;
  }

  const confidence = Math.max(0.45, Math.min(0.78, 0.5 + Number(rb.confidenceBoost || 0)));
  const cost =
    estimatedCost != null && Number.isFinite(Number(estimatedCost))
      ? Math.max(0, Math.round(Number(estimatedCost)))
      : 3500;

  return {
    probable_causes: causes,
    recommended_checks: checks.slice(0, 5),
    urgency,
    confidence,
    estimated_cost_from: cost,
    summary,
    status: 'SUCCESS',
    analysis_available: true,
    reason: null,
    disclaimer: 'Результат предварительный и не заменяет техническую диагностику автомобиля специалистом.',
    execution_meta: executionMeta
      ? { ...executionMeta, status: executionMeta.status || 'FALLBACK', errorCode: reason || 'LLM_UNAVAILABLE' }
      : null,
  };
}

export function buildManualReviewDiagnosis({ reason, executionMeta, ruleBased }: any) {
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
