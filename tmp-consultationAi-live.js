import {
  DIAGNOSIS_FORMAT_SCHEMA,
  DIAGNOSIS_SYSTEM_PROMPT,
  diagnosisUserPrompt,
} from '../../prompts/consultationPrompts.js';
import { getRelevantCases } from '../../services/caseMemory.service.js';
import { isFieldFilled } from '../../services/consultationFlowService.js';
import { chatCompletion } from '../../services/ollamaService.js';
import { pickPlaybook, playbookToAiHints } from '../../lib/diagnosticPlaybooks.js';
import { topWorksForCategory, topWorksForCategoryAndMake } from '../../lib/workStats.js';

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
    probable_causes: ['Требуется очная проверка основных узлов по заявленным симптомам'],
    recommended_checks: ['Провести первичную диагностику в сервисе', 'Проверить автомобиль на подъемнике'],
    urgency: 'low',
    confidence: 0.35,
    estimated_cost_from: null,
    summary:
      'По текущим данным невозможно сделать надежный вывод. Рекомендуем очную диагностику для уточнения причин.',
  };
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
  const cost = obj.estimated_cost_from == null ? null : Number(obj.estimated_cost_from);
  return {
    probable_causes: causes.length >= 1 ? causes : fallback.probable_causes,
    recommended_checks: checks.length >= 1 ? checks : fallback.recommended_checks,
    urgency,
    confidence,
    estimated_cost_from: Number.isFinite(cost) ? Math.max(0, Math.round(cost)) : null,
    summary: String(obj.summary || fallback.summary).trim(),
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
  const urgencyRaw = String(result?.urgency || '').toLowerCase();
  const urgency = ['low', 'medium', 'high'].includes(urgencyRaw) ? urgencyRaw : 'low';

  let probable_causes = Array.isArray(result?.probable_causes)
    ? result.probable_causes.map((x) => coerceDiagnosisLine(x)).filter(Boolean)
    : [];
  probable_causes = probable_causes.slice(0, 5);
  if (probable_causes.length === 0) {
    probable_causes = ['Требуется дополнительная проверка системы по заявленным симптомам'];
  }

  let recommended_checks = Array.isArray(result?.recommended_checks)
    ? result.recommended_checks.map((x) => coerceDiagnosisLine(x)).filter(Boolean)
    : [];
  recommended_checks = recommended_checks.slice(0, 5);
  if (recommended_checks.length === 0) {
    recommended_checks = ['Компьютерная диагностика', 'Осмотр автомобиля в сервисе'];
  }

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
    ['low', 'medium', 'high'].includes(String(rb.urgency)) ? String(rb.urgency) : 'low',
    ['low', 'medium', 'high'].includes(String(base.urgency)) ? String(base.urgency) : 'low',
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
export async function generateDiagnosis(data) {
  const cond = data?.conditions ?? data?.problemConditions;
  if (
    !isFieldFilled('mileage', data.mileage) ||
    !isFieldFilled('symptoms', data.symptoms) ||
    !isFieldFilled('conditions', cond)
  ) {
    return safeDiagnosisFallback();
  }

  const payload = {
    car_make: data.car_make ?? null,
    car_model: data.car_model ?? null,
    year: data.year ?? null,
    mileage: data.mileage ?? null,
    symptoms: data.symptoms ?? null,
    conditions: cond ?? null,
    urgency_signs: data.urgency_signs ?? null,
    category: data.category ?? null,
  };

  const ruleBased = preAnalyzeSymptoms(payload);

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
    relatedCases = await getRelevantCases(payload, 3);
  } catch {
    relatedCases = [];
  }
  try {
    const raw = await chatCompletion({
      temperature: 0.2,
      format: DIAGNOSIS_FORMAT_SCHEMA,
      messages: [
        { role: 'system', content: DIAGNOSIS_SYSTEM_PROMPT },
        { role: 'user', content: diagnosisUserPrompt(payload, relatedCases, pbHints, tw) },
      ],
    });
    const llmDiagnosis = normalizeDiagnosis(JSON.parse(raw));
    return mergeDiagnosis(ruleBased, llmDiagnosis);
  } catch {
    return mergeDiagnosis(ruleBased, safeDiagnosisFallback());
  }
}
