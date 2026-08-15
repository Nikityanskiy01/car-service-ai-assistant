import { coerceDiagnosisLine } from './coerce.js';
import { isGenericDiagnosisText, isManualStatus, maxUrgency, safeDiagnosisFallback } from './quality.js';

function normalizeDiagnosis(raw) {
  const fallback = safeDiagnosisFallback();
  const obj = raw && typeof raw === 'object' ? raw : {};
  const urgency = ['low', 'medium', 'high', 'critical'].includes(String(obj.urgency || ''))
    ? String(obj.urgency)
    : fallback.urgency;
  const conf = Number(obj.confidence);
  const confidence = Number.isFinite(conf) ? Math.max(0, Math.min(1, conf)) : fallback.confidence;
  const causes = Array.isArray(obj.probable_causes)
    ? obj.probable_causes.map((x) => coerceDiagnosisLine(x)).filter(Boolean).slice(0, 5)
    : [];
  const checks = Array.isArray(obj.recommended_checks)
    ? obj.recommended_checks.map((x) => coerceDiagnosisLine(x)).filter(Boolean).slice(0, 5)
    : [];
  const cleanedCauses = causes.filter((x) => !isGenericDiagnosisText(x));
  const cleanedChecks = checks.filter((x) => !isGenericDiagnosisText(x));
  const cost = obj.estimated_cost_from == null ? null : Number(obj.estimated_cost_from);
  return {
    probable_causes: cleanedCauses,
    recommended_checks: cleanedChecks,
    urgency,
    confidence,
    estimated_cost_from: Number.isFinite(cost) ? Math.max(0, Math.round(cost)) : null,
    summary: String(obj.summary || '').trim(),
    disclaimer:
      String(obj.disclaimer || '').trim() ||
      'Результат предварительный и не заменяет техническую диагностику автомобиля специалистом.',
    status: isManualStatus(obj.status) ? 'MANUAL_REVIEW_REQUIRED' : 'SUCCESS',
    analysis_available: !isManualStatus(obj.status),
    reason: obj.reason ? String(obj.reason) : null,
  };
}

/**
 * Краткий итог по списку причин из rule-based + merge (первые 3 в текст).
 * @param {string[] | undefined} probableCauses
 */
export function buildRuleBasedSummary(probableCauses) {
  if (!probableCauses?.length) {
    return 'По текущим симптомам требуется дополнительная диагностика автомобиля в сервисе.';
  }

  return (
    'Наиболее вероятные причины неисправности: ' +
    probableCauses.slice(0, 3).join(', ') +
    '. Рекомендуется выполнить первичную проверку указанных узлов.'
  );
}

/**
 * Слишком короткий или «отписка» LLM — лучше заменить на rule-based summary.
 * @param {unknown} summary
 */
export function isWeakSummary(summary) {
  if (!summary || typeof summary !== 'string') return true;
  const s = summary.toLowerCase().trim();

  if (s.length < 40) return true;

  const weakMarkers = [
    'требуется диагностика',
    'требуется дополнительная диагностика',
    'невозможно сделать вывод',
    'невозможно сделать надежный вывод',
    'рекомендуем очную диагностику',
    'нужна очная проверка',
    'обратитесь в сервис',
  ];

  return weakMarkers.some((marker) => s.includes(marker));
}

/** Дедупликация строк без учёта регистра; порядок — как в входном массиве (LLM первым). */
function dedupeStringsPreserveOrder(arr) {
  const seen = new Set();
  const out = [];
  for (const x of arr) {
    const s = coerceDiagnosisLine(x);
    if (!s) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

/**
 * Финальная нормализация объекта диагноза после merge.
 * @param {Record<string, unknown>} result
 */
export function normalizeDiagnosisResult(result) {
  if (isManualStatus(result?.status) || result?.analysis_available === false) {
    return {
      ...safeDiagnosisFallback(),
      status: 'MANUAL_REVIEW_REQUIRED',
      analysis_available: false,
      reason: String(result?.reason || 'LLM_UNAVAILABLE'),
      execution_meta: result?.execution_meta || null,
    };
  }
  const urgencyRaw = String(result?.urgency || '').toLowerCase();
  const urgency = ['low', 'medium', 'high', 'critical'].includes(urgencyRaw) ? urgencyRaw : 'low';

  let probable_causes = Array.isArray(result?.probable_causes)
    ? result.probable_causes.map((x) => coerceDiagnosisLine(x)).filter(Boolean)
    : [];
  probable_causes = probable_causes.slice(0, 5);
  let recommended_checks = Array.isArray(result?.recommended_checks)
    ? result.recommended_checks.map((x) => coerceDiagnosisLine(x)).filter(Boolean)
    : [];
  recommended_checks = recommended_checks.slice(0, 5);

  let confidence = Number(result?.confidence);
  if (!Number.isFinite(confidence)) confidence = 0.45;
  confidence = Math.max(0, Math.min(1, confidence));

  let estimated_cost_from = result?.estimated_cost_from;
  if (estimated_cost_from != null && Number.isFinite(Number(estimated_cost_from))) {
    estimated_cost_from = Math.max(0, Math.round(Number(estimated_cost_from)));
  } else {
    estimated_cost_from = null;
  }

  const summary = String(result?.summary ?? '').trim();

  return {
    probable_causes,
    recommended_checks,
    urgency,
    confidence,
    estimated_cost_from,
    summary,
    status: 'SUCCESS',
    analysis_available: true,
    reason: null,
    disclaimer:
      String(result?.disclaimer || '').trim() ||
      'Результат предварительный и не заменяет техническую диагностику автомобиля специалистом.',
    execution_meta: result?.execution_meta || null,
  };
}

/**
 * Объединяет rule-based пре-анализ и ответ LLM: причины и проверки без дублей, макс. по 5.
 * Срочность — максимум из двух источников. summary — с fallback на rule-based при «слабом» LLM.
 * @param {ReturnType<typeof import('./preAnalyze.js').preAnalyzeSymptoms>} ruleBased
 * @param {ReturnType<typeof normalizeDiagnosis>} llmDiagnosis
 */
export function mergeDiagnosis(ruleBased, llmDiagnosis) {
  const base = normalizeDiagnosis(llmDiagnosis);
  const rb = ruleBased || {
    probable_causes: [],
    recommended_checks: [],
    urgency: 'low',
    confidenceBoost: 0,
  };

  const probable_causes = dedupeStringsPreserveOrder([
    ...base.probable_causes,
    ...rb.probable_causes,
  ]).slice(0, 5);

  const recommended_checks = dedupeStringsPreserveOrder([
    ...base.recommended_checks,
    ...rb.recommended_checks,
  ]).slice(0, 5);

  const urgency = maxUrgency(
    ['low', 'medium', 'high', 'critical'].includes(String(rb.urgency)) ? String(rb.urgency) : 'low',
    ['low', 'medium', 'high', 'critical'].includes(String(base.urgency)) ? String(base.urgency) : 'low',
  );

  let confidence = Number(base.confidence);
  if (!Number.isFinite(confidence)) confidence = 0.4;
  confidence = Math.max(0, Math.min(1, confidence + Number(rb.confidenceBoost || 0)));

  let estimated_cost_from = base.estimated_cost_from;
  if (estimated_cost_from != null && Number.isFinite(Number(estimated_cost_from))) {
    estimated_cost_from = Math.max(0, Math.round(Number(estimated_cost_from)));
  } else {
    estimated_cost_from = null;
  }

  let summary = !isWeakSummary(base.summary)
    ? base.summary
    : buildRuleBasedSummary(probable_causes);

  if (urgency === 'critical') {
    const lowSummary = summary.toLowerCase();
    if (!lowSummary.includes('прекрат') && !lowSummary.includes('эвакуатор')) {
      summary =
        'Возможна критическая неисправность. Рекомендуется прекратить эксплуатацию автомобиля и организовать доставку в сервис эвакуатором. ' +
        summary;
    }
  }

  return normalizeDiagnosisResult({
    probable_causes,
    recommended_checks,
    urgency,
    confidence,
    estimated_cost_from,
    summary,
  });
}

export { normalizeDiagnosis };
