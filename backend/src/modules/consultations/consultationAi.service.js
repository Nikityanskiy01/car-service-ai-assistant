import {
  DIAGNOSIS_FORMAT_SCHEMA,
  DIAGNOSIS_SYSTEM_PROMPT,
  diagnosisUserPrompt,
} from '../../prompts/consultationPrompts.js';
import { getEnv } from '../../config/env.js';
import { getRelevantCases } from '../../services/caseMemory.service.js';
import { isFieldFilled } from '../../services/consultationFlowService.js';
import { chatCompletion } from '../../services/llmService.js';
import { runDiagnosisAgent } from '../../services/diagnosisAgent.service.js';
import { pickPlaybook, playbookToAiHints } from '../../lib/diagnosticPlaybooks.js';
import { topWorksForCategory, topWorksForCategoryAndMake } from '../../lib/workStats.js';
import { safeJsonParse } from '../../utils/safeJsonParse.js';
import { telemetryInc, telemetryObservePhase } from '../../services/diagnosticsTelemetry.service.js';

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

function safeDiagnosisFallback(data = {}) {
  const text = String(data?.symptoms || '').trim();
  return {
    probable_causes: text ? [`Не удалось получить ответ LLM по запросу: "${text}"`] : [],
    recommended_checks: ['Повторить запрос к диагностике через 10-20 секунд'],
    urgency: 'medium',
    confidence: 0.2,
    estimated_cost_from: null,
    summary:
      'Диагностическая модель временно недоступна или не успела ответить. Повторите запрос: финальный список причин и проверок формируется только на ответе нейросети.',
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

const DEFAULT_CAUSE_FALLBACK = 'Требуется дополнительная проверка системы по заявленным симптомам';
const DEFAULT_CHECK_FALLBACK_1 = 'Компьютерная диагностика';
const DEFAULT_CHECK_FALLBACK_2 = 'Осмотр автомобиля в сервисе';

/**
 * Определяет, что итог всё ещё слишком общий и требует повторного запроса к LLM.
 * @param {{ probable_causes?: string[], recommended_checks?: string[], estimated_cost_from?: number | null, summary?: string }} result
 */
function looksLikeDefaultDiagnosis(result) {
  const causes = Array.isArray(result?.probable_causes) ? result.probable_causes : [];
  const checks = Array.isArray(result?.recommended_checks) ? result.recommended_checks : [];
  const cost = Number(result?.estimated_cost_from);
  const summary = String(result?.summary || '');

  const hasOnlyDefaultCause =
    causes.length === 1 && String(causes[0] || '').trim() === DEFAULT_CAUSE_FALLBACK;
  const hasOnlyDefaultChecks =
    checks.length === 2 &&
    String(checks[0] || '').trim() === DEFAULT_CHECK_FALLBACK_1 &&
    String(checks[1] || '').trim() === DEFAULT_CHECK_FALLBACK_2;
  const hasMissingCost = !Number.isFinite(cost) || cost <= 0;

  return hasOnlyDefaultCause || hasOnlyDefaultChecks || hasMissingCost || isWeakSummary(summary);
}

function isTransientLlmFailure(err) {
  const msg = String(err?.message || err || '').toLowerCase();
  return (
    msg.includes('timed out') ||
    msg.includes('timeout') ||
    msg.includes('llm unavailable') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout') ||
    msg.includes('socket hang up') ||
    msg.includes('network')
  );
}

const URGENCY_RANK = { low: 1, medium: 2, high: 3 };

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

  // 3c. Сильный шум/рев при разгоне или нажатии на газ
  if (
    (symptoms.includes('рев') ||
      symptoms.includes('рёв') ||
      symptoms.includes('гул') ||
      symptoms.includes('шум') ||
      symptoms.includes('свист')) &&
    (joined.includes('разгон') ||
      joined.includes('нажатии на газ') ||
      joined.includes('на газ') ||
      joined.includes('под нагрузк'))
  ) {
    rulesMatched++;
    pushCause('Негерметичность выхлопной системы (гофра, коллектор, стыки)');
    pushCause('Подсос воздуха во впуске или повреждение патрубков');
    pushCause('Износ роликов/натяжителя приводного ремня навесных агрегатов');
    pushCause('Смещение фаз или нестабильная работа системы зажигания под нагрузкой');
    pushCheck('Проверить герметичность выпускного тракта и коллектора на подъемнике');
    pushCheck('Проверить впуск дымогенератором на подсос воздуха и трещины патрубков');
    pushCheck('Считать live-параметры: коррекции топлива, MAF/MAP, угол опережения при разгоне');
    pushCheck('Прослушать ролики/натяжитель и навесные агрегаты на повышенных оборотах');
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

  // Доп. эвристика срочности по ключевым словам (если правила не задали high)
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
  const urgency = ['low', 'medium', 'high'].includes(String(obj.urgency || '')) ? String(obj.urgency) : fallback.urgency;
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
  };
}

/**
 * Если LLM дал достаточно конкретный и уверенный ответ, не "размываем" его rule-based вставками.
 * @param {{ probable_causes?: string[], recommended_checks?: string[], confidence?: number }} base
 */
function isStrongLlmDiagnosis(base) {
  const causes = Array.isArray(base?.probable_causes) ? base.probable_causes.filter(Boolean) : [];
  const checks = Array.isArray(base?.recommended_checks) ? base.recommended_checks.filter(Boolean) : [];
  const conf = Number(base?.confidence);
  return causes.length >= 3 && checks.length >= 2 && Number.isFinite(conf) && conf >= 0.5;
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
  const urgencyRaw = String(result?.urgency || '').toLowerCase();
  const urgency = ['low', 'medium', 'high'].includes(urgencyRaw) ? urgencyRaw : 'low';

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
    // Keep UI cost section populated for completed diagnosis flows.
    estimated_cost_from = 2500;
  }

  const summary = String(result?.summary ?? '').trim();

  return {
    probable_causes,
    recommended_checks,
    urgency,
    confidence,
    estimated_cost_from,
    summary,
  };
}

function estimateCaseComplexity(payload) {
  const text = `${payload?.symptoms || ''} ${payload?.conditions || ''}`.toLowerCase();
  let score = 1;
  if (text.length > 80) score++;
  if (/[,.]| и | либо | при | когда | после | иногда | периодически/.test(text)) score++;
  if ((text.match(/\b(и|или)\b/g) || []).length >= 2) score++;
  if (/(ошибка|чек|перегрев|не завод|глох|вибрац|стук|рывк|тормоз)/.test(text)) score++;
  return Math.min(10, score);
}

function remainingBudgetMs(deadlineAtMs) {
  if (!Number.isFinite(Number(deadlineAtMs))) return Number.POSITIVE_INFINITY;
  return Math.max(0, Math.round(Number(deadlineAtMs) - Date.now()));
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

  const strongLlm = isStrongLlmDiagnosis(base);

  // При сильном LLM-ответе не добавляем rule-based шум.
  const probable_causes = strongLlm
    ? dedupeStringsPreserveOrder(base.probable_causes).slice(0, 5)
    : dedupeStringsPreserveOrder([...base.probable_causes, ...rb.probable_causes]).slice(0, 5);

  const recommended_checks = strongLlm
    ? dedupeStringsPreserveOrder(base.recommended_checks).slice(0, 5)
    : dedupeStringsPreserveOrder([...base.recommended_checks, ...rb.recommended_checks]).slice(0, 5);

  const urgency = maxUrgency(
    ['low', 'medium', 'high'].includes(String(rb.urgency)) ? String(rb.urgency) : 'low',
    ['low', 'medium', 'high'].includes(String(base.urgency)) ? String(base.urgency) : 'low',
  );

  let confidence = Number(base.confidence);
  if (!Number.isFinite(confidence)) confidence = 0.4;
  // При сильном ответе оставляем confidence LLM как есть.
  confidence = strongLlm
    ? Math.max(0, Math.min(1, confidence))
    : Math.max(0, Math.min(1, confidence + Number(rb.confidenceBoost || 0)));

  let estimated_cost_from = base.estimated_cost_from;
  if (estimated_cost_from != null && Number.isFinite(Number(estimated_cost_from))) {
    estimated_cost_from = Math.max(0, Math.round(Number(estimated_cost_from)));
  } else {
    estimated_cost_from = null;
  }

  const summary = !isWeakSummary(base.summary)
    ? base.summary
    : buildRuleBasedSummary(probable_causes);

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
export async function generateDiagnosis(data, options = {}) {
  const startedAt = Date.now();
  if (!isFieldFilled('mileage', data.mileage) || !isFieldFilled('symptoms', data.symptoms)) {
    return safeDiagnosisFallback(data);
  }

  const cond = data?.conditions ?? data?.problemConditions;
  const payload = {
    car_make: data.car_make ?? null,
    car_model: data.car_model ?? null,
    year: data.year ?? null,
    mileage: data.mileage ?? null,
    symptoms: data.symptoms ?? null,
    conditions: cond ?? null,
    urgency_signs: data.urgency_signs ?? null,
    category: data.category ?? null,
    intent: data.intent ?? null,
    service_type: data.service_type ?? null,
  };
  const env = getEnv();
  const allowLlmFallback = Boolean(env.LLM_FALLBACK_ENABLED);
  // Диагностика по умолчанию опирается на знания модели, а не на rule-based шаблоны.
  const llmOnly = true;
  const budgetMs = Number(options?.timeBudgetMs || env.DIAGNOSIS_TURN_BUDGET_MS || 20_000);
  const deadlineAtMs = Number(options?.deadlineAtMs || startedAt + budgetMs);
  const complexity = estimateCaseComplexity(payload);
  const complexityThreshold = Number(env.DIAGNOSIS_COMPLEXITY_THRESHOLD || 4);
  const useFastPath = Boolean(env.DIAGNOSIS_FAST_PATH_ENABLED) && complexity <= complexityThreshold;
  const minRemaining = Number(env.DIAGNOSIS_MIN_REMAINING_MS || 6000);

  const ruleBased = llmOnly ? null : preAnalyzeSymptoms(payload);

  const useAgentHints = Boolean(env.DIAGNOSIS_AGENT_USE_HINTS) && !llmOnly;
  const pb = useAgentHints ? pickPlaybook(payload, String(data.symptoms || '')) : null;
  const pbHints = useAgentHints ? playbookToAiHints(pb) : null;
  const tw = useAgentHints
    ? pbHints?.categoryId && payload.car_make
      ? topWorksForCategoryAndMake(pbHints.categoryId, payload.car_make, 10)
      : pbHints?.categoryId
        ? topWorksForCategory(pbHints.categoryId, 10)
        : []
    : [];

  let relatedCases = [];
  if (useAgentHints) {
    try {
      relatedCases = await getRelevantCases(payload, 3);
    } catch {
      relatedCases = [];
    }
  }

  const runClassicDiagnosis = async () => {
    const defaultModel = String(env.LLM_MODEL || '').trim();
    const autoFastModel = defaultModel.includes('thinking') ? defaultModel.replace(/-thinking\b/, '') : defaultModel;
    const diagnosisModel = env.LLM_DIAGNOSIS_MODEL?.trim() || autoFastModel || defaultModel;
    const localBudget = remainingBudgetMs(deadlineAtMs);
    const envTimeout = Math.max(6_000, Number(env.LLM_DIAGNOSIS_TIMEOUT_MS || 30_000));
    const timeoutMs = Math.max(6_000, Math.min(envTimeout, Math.max(6_000, localBudget)));
    const runEmergencyLlmDiagnosis = async () => {
      const emergencyTimeoutMs = Math.max(1800, Math.min(4000, Math.max(1800, remainingBudgetMs(deadlineAtMs))));
      const emergencyRaw = await chatCompletion({
        model: diagnosisModel,
        temperature: 0.1,
        timeoutMs: emergencyTimeoutMs,
        keepAlive: env.LLM_KEEP_ALIVE,
        maxTokens: Math.min(500, Number(env.LLM_DIAGNOSIS_NUM_PREDICT || 700)),
        messages: [
          {
            role: 'system',
            content:
              'Верни только JSON-объект с полями probable_causes (массив строк), recommended_checks (массив строк), urgency, confidence, estimated_cost_from, summary.',
          },
          {
            role: 'user',
            content:
              `${diagnosisUserPrompt(payload, relatedCases, pbHints, tw)}\n\n` +
              'Не используй шаблонные фразы. Верни 2-6 probable_causes и 1-6 recommended_checks строго по контексту обращения.',
          },
        ],
      });
      const emergencyParsed = safeJsonParse(emergencyRaw);
      if (!emergencyParsed) throw new Error('diagnosis: emergency invalid json from llm');
      return normalizeDiagnosisResult(normalizeDiagnosis(emergencyParsed));
    };
    const callDiagnosisLlm = async () =>
      chatCompletion({
        model: diagnosisModel,
        temperature: 0.15,
        timeoutMs,
        keepAlive: env.LLM_KEEP_ALIVE,
        maxTokens: env.LLM_DIAGNOSIS_NUM_PREDICT,
        format: DIAGNOSIS_FORMAT_SCHEMA,
        options: {
          num_ctx: 3072,
        },
        messages: [
          { role: 'system', content: DIAGNOSIS_SYSTEM_PROMPT },
          { role: 'user', content: diagnosisUserPrompt(payload, relatedCases, pbHints, tw) },
        ],
      });
    try {
      const firstRaw = await callDiagnosisLlm();
      let parsed = safeJsonParse(firstRaw);
      if (!parsed) {
        const secondRaw = await chatCompletion({
          model: diagnosisModel,
          temperature: 0,
          timeoutMs,
          maxTokens: env.LLM_DIAGNOSIS_NUM_PREDICT,
          format: DIAGNOSIS_FORMAT_SCHEMA,
          messages: [
            { role: 'system', content: DIAGNOSIS_SYSTEM_PROMPT },
            {
              role: 'user',
              content:
                `${diagnosisUserPrompt(payload, relatedCases, pbHints, tw)}\n` +
                'Исправь предыдущий ответ: верни только валидный JSON строго по схеме.',
            },
          ],
        });
        parsed = safeJsonParse(secondRaw);
      }
      if (!parsed) throw new Error('diagnosis: invalid json from llm');
      const llmDiagnosis = normalizeDiagnosis(parsed);
      let out = normalizeDiagnosisResult(llmDiagnosis);

      // Иногда первая генерация получается слишком общей; делаем повторный короткий проход.
      if (remainingBudgetMs(deadlineAtMs) > minRemaining && looksLikeDefaultDiagnosis(out)) {
        try {
          const repairRaw = await chatCompletion({
            model: diagnosisModel,
            temperature: 0.05,
            timeoutMs,
            keepAlive: env.LLM_KEEP_ALIVE,
            maxTokens: env.LLM_DIAGNOSIS_NUM_PREDICT,
            format: DIAGNOSIS_FORMAT_SCHEMA,
            options: { num_ctx: 3072 },
            messages: [
              { role: 'system', content: DIAGNOSIS_SYSTEM_PROMPT },
              {
                role: 'user',
                content:
                  `${diagnosisUserPrompt(payload, relatedCases, pbHints, tw)}\n\n` +
                  'Верни более конкретный результат: 2-6 probable_causes, 1-6 recommended_checks и минимальную цену estimated_cost_from > 0. ' +
                  'Избегай общих фраз и верни только JSON по схеме.',
              },
            ],
          });
          const repairParsed = safeJsonParse(repairRaw);
          if (repairParsed) {
            const repaired = normalizeDiagnosis(repairParsed);
            out = normalizeDiagnosisResult(repaired);
          }
        } catch {
          // Оставляем исходный результат, если повторный проход не удался.
        }
      }

      return out;
    } catch (err) {
      if (isTransientLlmFailure(err)) {
        try {
          return await runEmergencyLlmDiagnosis();
        } catch {
          // Переходим к нижнему fallback только если даже emergency-проход не сработал.
        }
      }
      // Даже в strict LLM-first режиме не роняем консультацию на сетевых/таймаут ошибках LLM.
      if (!allowLlmFallback && !isTransientLlmFailure(err)) {
        throw new Error(`diagnosis_llm_failed: ${String(err?.message || err)}`);
      }
      telemetryInc('fallback');
      // Резервный путь используем при включенном fallback и при временных сбоях LLM.
      return safeDiagnosisFallback(payload, ruleBased);
    }
  };

  if (remainingBudgetMs(deadlineAtMs) < minRemaining) {
    telemetryInc('budgetCutoffs');
    // Даже при малом бюджете пробуем короткий LLM-вызов, чтобы не возвращать одинаковый шаблон.
    return runClassicDiagnosis();
  }

  if (useFastPath || remainingBudgetMs(deadlineAtMs) < minRemaining * 2) {
    telemetryObservePhase('diagnosing', Date.now() - startedAt);
    return runClassicDiagnosis();
  }

  if (env.DIAGNOSIS_AGENT_MODE === 'llmfactory') {
    try {
      const agentTimeoutMs = Math.max(
        5_000,
        Math.min(
          Number(env.DIAGNOSIS_AGENT_TIMEOUT_MS || env.LLM_DIAGNOSIS_TIMEOUT_MS || 30_000),
          Math.max(5_000, remainingBudgetMs(deadlineAtMs) - 1_500),
        ),
      );
      const agent = await runDiagnosisAgent({
        payload,
        relatedCases,
        playbook: pbHints,
        topWorks: tw,
        useHints: useAgentHints,
        profile: env.DIAGNOSIS_AGENT_PROFILE || 'compact',
        env: { ...env, DIAGNOSIS_AGENT_TIMEOUT_MS: agentTimeoutMs },
        logger: console,
        onProgress: options?.onProgress,
      });
      telemetryObservePhase('diagnosing', Date.now() - startedAt);
      return normalizeDiagnosisResult(agent.diagnosis);
    } catch (err) {
      if (!allowLlmFallback && !isTransientLlmFailure(err)) {
        throw err;
      }
      telemetryInc('fallback');
      console.warn('diagnosis_agent_fallback_to_classic', {
        reason: String(err?.message || err),
      });
    }
  }

  const out = await runClassicDiagnosis();
  telemetryObservePhase('diagnosing', Date.now() - startedAt);
  return out;
}
