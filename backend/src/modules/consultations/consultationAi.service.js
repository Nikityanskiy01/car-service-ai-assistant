import {
  DIAGNOSIS_FORMAT_SCHEMA,
  DIAGNOSIS_SYSTEM_PROMPT,
  diagnosisUserPrompt,
} from '../../prompts/consultationPrompts.js';
import { getEnv } from '../../config/env.js';
import { getRelevantCases } from '../../services/caseMemory.service.js';
import { getConfirmedFewShotExamples } from '../../services/consultationFeedback.service.js';
import { runDiagnosisQueued } from '../../services/diagnosisQueue.service.js';
import { recordDiagnosisCacheHit, recordLlmValidationFailure } from '../../services/llmMetrics.service.js';
import {
  buildDiagnosisCacheKey,
  getDiagnosisCache,
  setDiagnosisCache,
} from '../../lib/diagnosisCache.js';
import { isFieldFilled } from '../../services/consultationFlowService.js';
import { chatCompletionWithMeta } from '../../services/ollamaService.js';
import { pickPlaybook, playbookToAiHints } from '../../lib/diagnosticPlaybooks.js';
import { formatObdForPrompt } from '../../lib/obdCodeCatalog.js';
import { parseObdCodes } from '../../lib/obdCodes.js';
import { topWorksForCategory, topWorksForCategoryAndMake } from '../../lib/workStats.js';
import { safeJsonParse } from '../../utils/safeJsonParse.js';
import { logger } from '../../lib/logger.js';

export {
  buildConsultationState,
  extractConsultationData,
  progressFromConsultationSteps,
} from '../../services/consultationFlowService.js';
export { detectConsultationIntent, detectServiceType } from '../../services/consultationIntent.service.js';

/**
 * LLM иногда кладёт в массив объекты вида { title, name, ... } вместо строк.
 * Прямой String(obj) даёт "[object Object]" в UI и в БД.
 * @param {unknown} x
 * @returns {string}
 */
export function coerceDiagnosisLine(x) {
  if (x == null) return '';
  if (typeof x === 'string') {
    const t = x.trim();
    if (t === '[object Object]' || /^object\s+object$/i.test(t)) return '';
    return t;
  }
  if (typeof x === 'number' && Number.isFinite(x)) return String(x);
  if (typeof x === 'object') {
    const o = /** @type {Record<string, unknown>} */ (x);
    const cand = o.title ?? o.name ?? o.text ?? o.cause ?? o.description ?? o.label ?? o.check;
    if (typeof cand === 'string' && cand.trim()) return cand.trim();
    if (typeof cand === 'number' && Number.isFinite(cand)) return String(cand);
  }
  return '';
}

function safeDiagnosisFallback() {
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

function isGenericDiagnosisText(text) {
  const s = String(text || '').toLowerCase().trim();
  if (!s) return true;
  return (
    s.includes('требуется очная проверка') ||
    s.includes('требуется дополнительная диагностика') ||
    s.includes('невозможно сделать') ||
    s.includes('обратитесь в сервис')
  );
}

const URGENCY_RANK = { low: 1, medium: 2, high: 3, critical: 4 };
const GENERIC_CAUSE_BLOCKLIST = [
  'требуется очная проверка',
  'рекомендуется провести диагностику',
  'необходимо обратиться в сервис',
  'возможны различные причины',
];

function isManualStatus(value) {
  return String(value || '').toUpperCase() === 'MANUAL_REVIEW_REQUIRED';
}

function validateDiagnosisQuality(result) {
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

function buildManualReviewDiagnosis({ reason, executionMeta, ruleBased }) {
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

function maxUrgency(a, b) {
  const ra = a in URGENCY_RANK ? URGENCY_RANK[a] : 1;
  const rb = b in URGENCY_RANK ? URGENCY_RANK[b] : 1;
  const va = a in URGENCY_RANK ? a : 'low';
  const vb = b in URGENCY_RANK ? b : 'low';
  return ra >= rb ? va : vb;
}

/**
 * Rule-based пре-анализ симптомов и условий. Без LLM.
 * @param {{ symptoms?: string | null, conditions?: string | null, problemConditions?: string | null }} data
 */
export function preAnalyzeSymptoms(data) {
  const symptoms = String(data?.symptoms || '').toLowerCase();
  const conditions = String(data?.conditions || data?.problemConditions || '').toLowerCase();
  const joined = `${symptoms} ${conditions}`.trim();

  const causes = [];
  const checks = [];
  let urgency = 'low';
  let rulesMatched = 0;

  const pushCause = (x) => {
    const s = String(x).trim();
    if (s && !causes.some((c) => c.toLowerCase() === s.toLowerCase())) causes.push(s);
  };
  const pushCheck = (x) => {
    const s = String(x).trim();
    if (s && !checks.some((c) => c.toLowerCase() === s.toLowerCase())) checks.push(s);
  };
  const raiseUrgency = (lvl) => {
    urgency = maxUrgency(urgency, lvl);
  };

  // 1. Тормоза: биение руля + при торможении
  if (symptoms.includes('биение руля') && conditions.includes('при торможении')) {
    rulesMatched++;
    pushCause('Деформация тормозных дисков');
    pushCause('Неравномерный износ тормозных колодок');
    pushCheck('Снять колёса и визуально оценить диски: трещины, ржавчина, следы перегрева');
    pushCheck('Промерить толщину тормозных дисков и колодок щупом/штангенциркулем по мануалу');
    pushCheck('Проверить биение диска при вращении (индикатор) и люфт направляющих суппорта');
    raiseUrgency('high');
  }

  // 1b. Вибрация руля при торможении (частый реальный кейс)
  if (
    (symptoms.includes('вибрац') && symptoms.includes('рул') && symptoms.includes('тормож')) ||
    (symptoms.includes('вибрац') && symptoms.includes('рул') && conditions.includes('тормож'))
  ) {
    rulesMatched++;
    pushCause('Деформация или перегрев тормозных дисков');
    pushCause('Неравномерный износ колодок и направляющих суппорта');
    pushCause('Люфт элементов передней подвески или ступичного узла');
    pushCheck('Проверить биение передних тормозных дисков индикатором на ступице');
    pushCheck('Осмотреть колодки, направляющие и поршни суппортов на заедание');
    pushCheck('Проверить люфты ступичных подшипников, рулевых наконечников и шаровых опор');
    raiseUrgency('high');
  }

  // 2. Стук на неровной дороге
  if (symptoms.includes('посторонний стук') && conditions.includes('на неровной дороге')) {
    rulesMatched++;
    pushCause('Стойки стабилизатора');
    pushCause('Втулки стабилизатора');
    pushCause('Шаровые опоры');
    pushCheck('Покачать стабилизатор: слушать стук в сайлентблоках и втулках');
    pushCheck('На подъёмнике проверить люфт шаровых и опор амортизаторов');
    raiseUrgency('medium');
  }

  // 2b. Стук в подвеске без фразы "на неровной дороге"
  if (
    (symptoms.includes('стук') || symptoms.includes('грохот')) &&
    (symptoms.includes('справа') || symptoms.includes('слева') || symptoms.includes('спереди'))
  ) {
    rulesMatched++;
    pushCause('Износ стоек/втулок стабилизатора');
    pushCause('Люфт шаровой опоры или рулевого наконечника');
    pushCause('Износ опоры амортизатора');
    pushCheck('Проверить подвеску на подъемнике с нагрузкой на шарниры и стойки');
    pushCheck('Проверить люфты рулевых наконечников и шаровых опор монтажкой');
    pushCheck('Оценить состояние опор амортизаторов и крепежа стойки');
    raiseUrgency('medium');
  }

  // 3. Троение двигателя
  if (
    symptoms.includes('двигатель троит') ||
    (symptoms.includes('троит') && !symptoms.includes('короб') && !symptoms.includes('передач'))
  ) {
    rulesMatched++;
    pushCause('Свечи зажигания');
    pushCause('Катушка зажигания');
    pushCause('Форсунки');
    pushCheck('Считать ошибки ЭБУ и оценить режимы форсунок по сканеру');
    pushCheck('Проверить свечи: зазор, изолятор, цвет нагара');
    pushCheck('Поменять свечи/катушки местами и сравнить работу цилиндров');
    raiseUrgency('medium');
  }

  // 3b. Пропуски на холостом / нестабильный холостой
  if (
    (symptoms.includes('пропуск') || symptoms.includes('пропуски')) &&
    (symptoms.includes('холост') || conditions.includes('холост'))
  ) {
    rulesMatched++;
    pushCause('Свечи зажигания');
    pushCause('Катушка зажигания');
    pushCause('Форсунки');
    pushCause('Подсос воздуха');
    pushCause('Дроссельная заслонка или датчики (ДПДЗ, ДХХ, MAF)');
    pushCheck('Считать стоп-кадр форсунок и коррекцию смеси по цилиндрам');
    pushCheck('Проверить разрежение на впуске и подсос на холостом (дымок/мыльный раствор)');
    pushCheck('Осмотреть и при необходимости очистить дроссель, проверить показания ДПДЗ');
    raiseUrgency('medium');
  }

  // 4. Не запускается + стартер / не схватывает (всё в симптомах)
  if (
    symptoms.includes('не запускается') &&
    (symptoms.includes('стартер') || symptoms.includes('не схватывает'))
  ) {
    rulesMatched++;
    pushCause('Отсутствие подачи топлива');
    pushCause('Неисправность системы зажигания');
    pushCause('Неисправность датчика положения коленчатого вала');
    pushCheck('Проверить давление топлива на рампе и работу бензонасоса при включении зажигания');
    pushCheck('Проверить искру на свече снятой катушки (осторожно, короткий тест)');
    pushCheck('Считать коды ЭБУ и проверить сигнал ДПКВ осциллографом/сканером при провороте');
    raiseUrgency('medium');
  }

  // 5. Плавают обороты
  if (symptoms.includes('плавают обороты')) {
    rulesMatched++;
    pushCause('Загрязнение дроссельной заслонки');
    pushCause('Подсос воздуха');
    pushCause('Неисправность датчика холостого хода или расходомера');
    pushCheck('Снять и промыть дроссельный узел, проверить прокладку');
    pushCheck('Продууть/опрыскать шланги впуска мыльным раствором на холостом — искать пузыри');
    pushCheck('Считать параметры ДПДЗ, ДХХ/MAF при прогреве');
    raiseUrgency('medium');
  }

  // 6. Перегрев
  if (symptoms.includes('перегрев')) {
    rulesMatched++;
    pushCause('Термостат');
    pushCause('Радиатор');
    pushCause('Помпа');
    pushCause('Утечка охлаждающей жидкости');
    pushCheck('Проверить уровень ОЖ в расширительном бачке при холодном двигателе');
    pushCheck('Проверить работу вентилятора и включение при прогреве (температура/диагностика)');
    pushCheck('Осмотреть патрубки, радиатор и помпу на подтёки; при необходимости — опрессовка');
    raiseUrgency('high');
  }

  // Критические ключи безопасности
  if (
    joined.includes('педаль тормоза') &&
    (joined.includes('провал') || joined.includes('не тормозит') || joined.includes('тормозит хуже'))
  ) {
    rulesMatched++;
    pushCause('Падение давления в тормозном контуре');
    pushCause('Утечка тормозной жидкости или неисправность главного тормозного цилиндра');
    pushCheck('Немедленно прекратить эксплуатацию и доставить автомобиль эвакуатором');
    pushCheck('Проверить герметичность контура и уровень тормозной жидкости');
    raiseUrgency('critical');
  }
  if (joined.includes('пар из-под капота') || joined.includes('дым из-под капота')) {
    rulesMatched++;
    pushCause('Критический перегрев силового агрегата или утечка рабочей жидкости');
    pushCheck('Остановиться в безопасном месте, заглушить двигатель, не открывать горячую крышку системы охлаждения');
    raiseUrgency('critical');
  }
  if (
    (joined.includes('запах') && joined.includes('бензин')) ||
    joined.includes('утечка топлива')
  ) {
    rulesMatched++;
    pushCause('Разгерметизация топливной магистрали');
    pushCheck('Прекратить эксплуатацию, исключить источники огня и организовать эвакуацию');
    raiseUrgency('critical');
  }
  if (joined.includes('давлен') && joined.includes('масл') && (joined.includes('красн') || joined.includes('горит'))) {
    rulesMatched++;
    pushCause('Критическое снижение давления масла в двигателе');
    pushCheck('Немедленно заглушить двигатель и не запускать до проверки системы смазки');
    raiseUrgency('critical');
  }

  // Доп. эвристика срочности по ключевым словам
  if (joined.includes('тормоз') || joined.includes('торможен')) raiseUrgency('high');
  if (joined.includes('перегрев') || joined.includes('кипит') || joined.includes('температур')) {
    raiseUrgency('high');
  }
  if (
    joined.includes('биение руля') ||
    joined.includes('люфт руля') ||
    (joined.includes('рулев') && (joined.includes('вибрац') || joined.includes('уводит')))
  ) {
    raiseUrgency('high');
  }
  if (
    joined.includes('сильн') &&
    (joined.includes('вибрац') || joined.includes('биен'))
  ) {
    raiseUrgency('high');
  }
  if (
    joined.includes('глохнет') ||
    joined.includes('заглох') ||
    (joined.includes('двигатель') && joined.includes('останов'))
  ) {
    raiseUrgency('high');
  }
  if (
    joined.includes('не тормозит') ||
    (joined.includes('рул') && joined.includes('не слушается')) ||
    (joined.includes('fire') || joined.includes('пожар'))
  ) {
    raiseUrgency('critical');
  }

  if (urgency === 'low') {
    if (
      joined.includes('плавают') ||
      joined.includes('троит') ||
      joined.includes('нестабильн') ||
      joined.includes('не запускается') ||
      joined.includes('не заводится')
    ) {
      raiseUrgency('medium');
    }
  }

  let confidenceBoost = 0;
  if (rulesMatched === 1) confidenceBoost = 0.08;
  else if (rulesMatched === 2) confidenceBoost = 0.16;
  else if (rulesMatched >= 3) confidenceBoost = 0.35;

  return {
    probable_causes: causes.slice(0, 5),
    recommended_checks: checks.slice(0, 5),
    urgency,
    confidenceBoost,
  };
}

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
 * @param {ReturnType<typeof preAnalyzeSymptoms>} ruleBased
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

/**
 * Гибридная диагностика: preAnalyzeSymptoms → LLM (JSON) → mergeDiagnosis.
 * LLM заполняет probable_causes, recommended_checks, urgency, confidence, estimated_cost_from, summary;
 * правила дополняют и повышают срочность/уверенность при совпадении сценариев.
 */
function cacheDiagnosisIfSuccessful(cacheKey, result) {
  if (result?.analysis_available !== false && result?.status !== 'MANUAL_REVIEW_REQUIRED') {
    setDiagnosisCache(cacheKey, result);
  }
  return result;
}

export async function generateDiagnosis(data) {
  return runDiagnosisQueued(() => generateDiagnosisCore(data));
}

export async function generateDiagnosisCore(data) {
  const cond = data?.conditions ?? data?.problemConditions;
  const payload = {
    car_make: data.car_make ?? null,
    car_model: data.car_model ?? null,
    year: data.year ?? null,
    mileage: data.mileage ?? null,
    symptoms: data.symptoms ?? null,
    conditions: cond ?? null,
    urgency_signs: data.urgency_signs ?? null,
    obd_codes: data.obd_codes ?? null,
    category: data.category ?? null,
  };
  const obdCodes = parseObdCodes(`${payload.obd_codes || ''} ${payload.symptoms || ''}`);
  const obdInterpretations = formatObdForPrompt(obdCodes);
  const photoObservations = Array.isArray(data.photo_observations)
    ? data.photo_observations.map((x) => String(x)).filter(Boolean).slice(0, 8)
    : [];

  const ruleBased = preAnalyzeSymptoms(payload);
  const hasCriticalSafety = String(ruleBased?.urgency || '').toLowerCase() === 'critical';
  if (!isFieldFilled('symptoms', data.symptoms) || (!isFieldFilled('conditions', cond) && !hasCriticalSafety)) {
    return buildManualReviewDiagnosis({ reason: 'INSUFFICIENT_DATA', ruleBased });
  }

  const cacheKey = buildDiagnosisCacheKey(payload);
  const cached = getDiagnosisCache(cacheKey);
  if (cached) {
    recordDiagnosisCacheHit();
    return cached;
  }

  const pb = pickPlaybook(payload, String(data.symptoms || ''));
  const pbHints = playbookToAiHints(pb);
  const tw =
    pbHints?.categoryId && payload.car_make
      ? topWorksForCategoryAndMake(pbHints.categoryId, payload.car_make, 10)
      : pbHints?.categoryId
        ? topWorksForCategory(pbHints.categoryId, 10)
        : [];

  let relatedCases = [];
  try {
    relatedCases = await getRelevantCases(payload);
  } catch {
    relatedCases = [];
  }
  let confirmedExamples = [];
  try {
    confirmedExamples = await getConfirmedFewShotExamples();
  } catch {
    confirmedExamples = [];
  }
  const env = getEnv();
  const diagnosisModel = env.LLM_DIAGNOSIS_MODEL?.trim() || env.LLM_MODEL;
  const callDiagnosisLlm = async (extraInstructions = '') =>
    chatCompletionWithMeta({
      model: diagnosisModel,
      temperature: 0.15,
      timeoutMs: env.LLM_DIAGNOSIS_TIMEOUT_MS,
      keepAlive: env.LLM_KEEP_ALIVE,
      format: DIAGNOSIS_FORMAT_SCHEMA,
      options: {
        num_predict: env.LLM_DIAGNOSIS_NUM_PREDICT,
        num_ctx: 3072,
      },
      messages: [
        { role: 'system', content: DIAGNOSIS_SYSTEM_PROMPT },
        {
          role: 'user',
          content:
            diagnosisUserPrompt(
              payload,
              relatedCases,
              pbHints,
              tw,
              obdInterpretations,
              photoObservations,
              confirmedExamples,
            ) +
            (extraInstructions ? `\n\nТребуется исправить JSON по замечаниям:\n${extraInstructions}` : ''),
        },
      ],
    });
  try {
    const startedAt = new Date().toISOString();
    const first = await callDiagnosisLlm();
    const executionMeta = {
      provider: first.provider === 'openai' ? 'vsellm' : first.provider,
      model: first.model || diagnosisModel || null,
      requestId: `diag-${Date.now()}`,
      startedAt,
      completedAt: new Date().toISOString(),
      durationMs: Number.isFinite(first.durationMs) ? first.durationMs : null,
      attemptCount: Number.isFinite(first.attemptCount) ? first.attemptCount : 1,
      streamed: Boolean(first.streamed),
      status: first.status === 'FALLBACK' ? 'FALLBACK' : 'SUCCESS',
      errorCode: null,
    };
    logger.info(
      {
        event: 'vsellm_response_received',
        provider: executionMeta.provider,
        model: executionMeta.model,
        durationMs: executionMeta.durationMs,
        attempts: executionMeta.attemptCount,
      },
      'diagnosis llm response received',
    );
    let parsed = safeJsonParse(first.content);
    if (!parsed) {
      const repaired = await callDiagnosisLlm('Ответ должен быть строго валидным JSON по целевой схеме.');
      parsed = safeJsonParse(repaired.content);
    }
    if (!parsed) throw new Error('diagnosis: invalid json from llm');
    const llmDiagnosis = normalizeDiagnosis(parsed);
    const merged = mergeDiagnosis(ruleBased, llmDiagnosis);
    const quality = validateDiagnosisQuality(merged);
    if (!quality.valid) {
      recordLlmValidationFailure();
      logger.warn(
        { event: 'vsellm_validation_failed', issues: quality.issues, model: executionMeta.model },
        'diagnosis quality validation failed',
      );
      const repaired = await callDiagnosisLlm(`Нарушения: ${quality.issues.join(', ')}`);
      const repairedParsed = safeJsonParse(repaired.content);
      if (repairedParsed) {
        const repairedMerged = mergeDiagnosis(ruleBased, normalizeDiagnosis(repairedParsed));
        const repairedQuality = validateDiagnosisQuality(repairedMerged);
        if (repairedQuality.valid) {
          return cacheDiagnosisIfSuccessful(
            cacheKey,
            normalizeDiagnosisResult({ ...repairedMerged, execution_meta: executionMeta }),
          );
        }
      }
      return buildManualReviewDiagnosis({ reason: 'LLM_VALIDATION_FAILED', executionMeta, ruleBased });
    }
    return cacheDiagnosisIfSuccessful(cacheKey, normalizeDiagnosisResult({ ...merged, execution_meta: executionMeta }));
  } catch (err) {
    logger.warn(
      {
        event: 'fallback_activated',
        code: 'LLM_UNAVAILABLE',
        err: err instanceof Error ? err.message : String(err || ''),
      },
      'diagnosis switched to manual review',
    );
    return buildManualReviewDiagnosis({
      reason: 'LLM_UNAVAILABLE',
      ruleBased,
      executionMeta: {
        provider: 'fallback',
        model: diagnosisModel || null,
        requestId: `diag-${Date.now()}`,
        startedAt: new Date().toISOString(),
        completedAt: null,
        durationMs: null,
        attemptCount: 1,
        streamed: false,
        status: 'FAILED',
        errorCode: 'LLM_UNAVAILABLE',
      },
    });
  }
}
