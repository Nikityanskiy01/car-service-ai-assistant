/**
 * Гибридный consultation flow: state machine + правила сценария.
 * LLM используется только для извлечения полей и диагностики — не для выбора следующего вопроса.
 */

import {
  ALT_FLOW_QUESTIONS,
  CATEGORY_CONDITIONS_QUESTIONS,
  CATEGORY_RULES,
  ENGINE_EXTRA_KEYWORDS,
  FLOW_QUESTIONS,
} from '../config/consultationFlow.config.js';
import { EXTRACTION_SYSTEM_PROMPT, extractionUserPrompt } from '../prompts/consultationPrompts.js';
import {
  detectConsultationIntent,
  detectServiceType,
  serviceResultAssistantMessage,
} from './consultationIntent.service.js';
import { chatCompletion } from './ollamaService.js';
import { safeJsonParse } from '../utils/safeJsonParse.js';

/** @typedef {"engine"|"brakes"|"suspension"|"steering"|"cooling"|"transmission"|"electrical"|"starting_system"|"fuel_system"|"unknown"} SymptomCategory */

export const EMPTY_CONSULTATION_STATE = {
  car_make: null,
  car_model: null,
  year: null,
  mileage: null,
  symptoms: null,
  conditions: null,
  urgency_signs: null,
  category: null,
  /** @type {'diagnostic'|'service'|null} */
  intent: null,
  /** @type {string|null} */
  service_type: null,
};

/**
 * @param {Record<string, unknown>} currentData
 * @param {Record<string, unknown>} newData
 */
export function mergeExtractedData(currentData, newData) {
  const out = { ...EMPTY_CONSULTATION_STATE, ...currentData };
  for (const key of Object.keys(EMPTY_CONSULTATION_STATE)) {
    if (key === 'category') continue;
    const v = newData[key];
    if (v === undefined || v === null) continue;
    if (typeof v === 'string' && !v.trim()) continue;
    out[key] = v;
  }
  return out;
}

/**
 * @param {string} field
 * @param {unknown} value
 */
export function isFieldFilled(field, value) {
  if (value === undefined || value === null) return false;
  if (field === 'year' || field === 'mileage') {
    const n = Number(value);
    return Number.isFinite(n) && n >= 0;
  }
  return String(value).trim().length > 0;
}

/**
 * Недостающие поля: марка → модель → пробег → описание запроса → условия (только diagnostic).
 * @param {Record<string, unknown>} data
 */
export function getMissingFields(data) {
  const base = ['car_make', 'car_model', 'mileage', 'symptoms'];
  const missing = base.filter((k) => !isFieldFilled(k, data[k]));
  if (missing.length) return missing;
  if (detectConsultationIntent(String(data.symptoms || '')) === 'service') {
    return [];
  }
  if (!isFieldFilled('conditions', data.conditions)) {
    return ['conditions'];
  }
  return [];
}

/**
 * @param {string} text
 */
export function normalizeConditions(text) {
  const src = String(text || '').trim();
  if (!src) return src;
  const low = src.toLowerCase();
  const map = [
    [/на\s+ходу/i, 'при движении'],
    [/при\s+движении/i, 'при движении'],
    [/при\s+запуске/i, 'при запуске двигателя'],
    [/на\s+холодную/i, 'на холодную'],
    [/на\s+горячую/i, 'на горячую'],
    [/при\s+торможении/i, 'при торможении'],
    [/на\s+кочках/i, 'на неровной дороге'],
    [/на\s+скорости/i, 'на скорости'],
    [/при\s+разгоне/i, 'при разгоне'],
    [/при\s+повороте/i, 'при повороте'],
    [/на\s+холостом/i, 'на холостом ходу'],
    [/после\s+прогрева/i, 'после прогрева'],
    [/в\s+пробке/i, 'в пробке'],
  ];
  let out = src;
  for (const [rx, rep] of map) {
    if (rx.test(low)) {
      out = rep;
      break;
    }
  }
  if (low.includes('при движении')) return 'при движении';
  if (low.includes('на ходу')) return 'при движении';
  return out;
}

/**
 * @param {string} text
 */
export function normalizeSymptoms(text) {
  let s = String(text || '').trim();
  if (!s) return s;
  const low = s.toLowerCase();
  const pairs = [
    [/не\s+заводится/i, 'не запускается'],
    [/не\s+заводит/i, 'не запускается'],
    [/троит/i, 'двигатель троит'],
    [/глохнет/i, 'двигатель глохнет'],
    [/плавают\s+обороты/i, 'плавают обороты'],
    [/биение\s+руля/i, 'биение руля'],
    [/^стук$/i, 'посторонний стук'],
  ];
  for (const [rx, rep] of pairs) {
    if (rx.test(low)) {
      s = rep;
      break;
    }
  }
  return s;
}

/**
 * @param {string} symptoms
 * @returns {SymptomCategory}
 */
export function detectSymptomCategory(symptoms) {
  const text = String(symptoms || '').toLowerCase();
  if (!text.trim()) return 'unknown';
  let best = { category: /** @type {SymptomCategory} */ ('unknown'), score: 0 };
  for (const { category, patterns } of CATEGORY_RULES) {
    let score = 0;
    for (const p of patterns) {
      if (text.includes(p)) score += p.split(/\s+/).length >= 2 ? 3 : 2;
    }
    if (category === 'engine') {
      for (const p of ENGINE_EXTRA_KEYWORDS) {
        if (text.includes(p)) score += 1;
      }
    }
    if (score > best.score) best = { category, score };
  }
  return best.score > 0 ? best.category : 'unknown';
}

/**
 * Строгий порядок: марка → модель → пробег → запрос → условия (только diagnostic).
 * @param {Record<string, unknown>} state
 * @returns {{ field: string, question: string } | null}
 */
export function getNextQuestion(state) {
  const data = { ...EMPTY_CONSULTATION_STATE, ...state };
  if (!isFieldFilled('car_make', data.car_make)) {
    return { field: 'car_make', question: FLOW_QUESTIONS.car_make };
  }
  if (!isFieldFilled('car_model', data.car_model)) {
    return { field: 'car_model', question: FLOW_QUESTIONS.car_model };
  }
  if (!isFieldFilled('mileage', data.mileage)) {
    return { field: 'mileage', question: FLOW_QUESTIONS.mileage };
  }
  if (!isFieldFilled('symptoms', data.symptoms)) {
    return { field: 'symptoms', question: FLOW_QUESTIONS.symptoms };
  }
  if (detectConsultationIntent(String(data.symptoms || '')) === 'service') {
    return null;
  }
  if (!isFieldFilled('conditions', data.conditions)) {
    return { field: 'conditions', question: FLOW_QUESTIONS.conditions };
  }
  return null;
}

/**
 * @param {{ messages?: Array<{ sender?: string, content?: string }> }} session
 * @param {{ field: string, question: string }} questionMeta
 * @param {Array<{ field: string, question: string }>} askedQuestions
 */
export function shouldAskQuestion(session, questionMeta, askedQuestions = []) {
  const lastAssistant = getLastAssistantContent(session?.messages || []);
  if (lastAssistant && questionMeta?.question && lastAssistant.trim() === questionMeta.question.trim()) {
    return false;
  }
  if (
    askedQuestions.some((x) => x.question && questionMeta?.question && x.question.trim() === questionMeta.question.trim())
  ) {
    return false;
  }
  return true;
}

/**
 * @param {SymptomCategory} category
 */
export function getCategoryConditionsQuestion(category) {
  return CATEGORY_CONDITIONS_QUESTIONS[category] || CATEGORY_CONDITIONS_QUESTIONS.unknown;
}

/** Совместимость со старым symptomClassifier */
export function generateCategoryFollowupQuestion(category) {
  return getCategoryConditionsQuestion(category);
}

/**
 * @param {Array<{ sender?: string, content?: string }>} messages
 */
export function getLastAssistantContent(messages) {
  if (!messages?.length) return null;
  for (let i = messages.length - 2; i >= 0; i--) {
    if (messages[i].sender === 'ASSISTANT') return String(messages[i].content || '');
  }
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].sender === 'ASSISTANT') return String(messages[i].content || '');
  }
  return null;
}

/**
 * Отсекает мусор в марке/модели после LLM.
 * Допускает коды моделей с одной буквой и цифрами (X5, A4, х5) и строки с цифрами (GLC300, 550i).
 * @param {unknown} value
 */
export function isValidVehicleText(value) {
  if (!value || typeof value !== 'string') return false;
  const v = value.trim();

  if (v.length < 2 || v.length > 25) return false;
  if (/^[0-9]+$/.test(v)) return false;
  if (/[^a-zA-Zа-яА-Я0-9-\s]/.test(v)) return false;

  const letters = (v.match(/[a-zA-Zа-яА-Я]/g) || []).length;
  const hasDigit = /[0-9]/.test(v);

  // X5, A4, х5, V12 — одна буква и цифры
  if (letters < 2) {
    return letters === 1 && hasDigit;
  }

  const vowels = (v.match(/[aeiouyаеёиоуыэюя]/gi) || []).length;
  // «bmw x5» как одна строка: 4+ согласных без гласных — нормально для латиницы/кодов
  if (letters >= 4 && vowels === 0 && !hasDigit) return false;

  return true;
}

function normalizeExtractedFromLlm(raw) {
  const obj = raw && typeof raw === 'object' ? raw : {};
  const text = (v) => {
    if (v == null) return null;
    const s = String(v).trim();
    return s.length ? s : null;
  };
  const int = (v) => {
    if (v == null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? Math.round(n) : null;
  };
  const year = int(obj.year);
  const mileage = int(obj.mileage);
  return {
    car_make: isValidVehicleText(obj.car_make) ? text(obj.car_make) : null,
    car_model: isValidVehicleText(obj.car_model) ? text(obj.car_model) : null,
    year: year != null && year >= 1950 && year <= 2100 ? year : null,
    mileage: mileage != null && mileage >= 0 ? mileage : null,
    symptoms: text(obj.symptoms),
    conditions: text(obj.conditions),
    urgency_signs: text(obj.urgency_signs),
    category: null,
  };
}

function extractMileageRegex(t) {
  const low = t.toLowerCase();
  let m =
    t.match(/пробег\D{0,12}(\d[\d\s]{2,7})/i) ||
    t.match(/\b(\d{2,3})\s*тыс(?:\s*км)?\b/i) ||
    t.match(/\b(\d{3,7})\s*км\b/i) ||
    t.match(/\b(\d{4,7})\b(?!\s*год)/i);
  if (!m) return null;
  const raw = String(m[1]).replace(/\s+/g, '');
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  if (/тыс/i.test(t) || (/пробег/i.test(low) && n < 1000)) return n * 1000;
  if (n >= 1000 && n < 1000000) return n;
  return n;
}

function extractYearRegex(t) {
  const m = t.match(/\b(19[7-9]\d|20[0-3]\d)\b/);
  return m ? Number(m[1]) : null;
}

const CONDITION_HINTS =
  /при\s+(движении|запуске|торможении|разгоне|повороте)|на\s+(холодную|горячую|ходу|кочках|скорости)|на\s+холост|после\s+прогрева|в\s+пробке/i;

const SYMPTOM_HINTS =
  /пропуск|троит|оборот|стук|скрип|вибрац|тормож|рывк|дым|перегрев|запуск|глох|биение|плава|чек|короб|рул|подвеск|старт/i;

/**
 * Rule-based pre-extraction до вызова LLM.
 * @param {string} message
 * @param {Record<string, unknown>} base
 */
export function preExtractFromRules(message, base = {}) {
  const out = mergeExtractedData(EMPTY_CONSULTATION_STATE, base);
  const t = String(message || '').trim();
  if (!t) return out;
  const low = t.toLowerCase();

  const y = extractYearRegex(t);
  if (y && !out.year) out.year = y;

  const mileage = extractMileageRegex(t);
  if (mileage != null) out.mileage = mileage;

  if (!out.car_make || !out.car_model) {
    const bmw = t.match(/^(?:бмв|bmw)\s+([a-zA-Zа-яА-Я0-9]{1,12})(?:\s|$)/i);
    if (bmw) {
      if (!out.car_make) out.car_make = 'BMW';
      if (!out.car_model) out.car_model = bmw[1];
    }
  }

  if (!out.conditions) {
    if (CONDITION_HINTS.test(t)) {
      const c = normalizeConditions(t);
      if (c && c.length > 2) out.conditions = c;
    }
  }

  if (!out.symptoms) {
    if (SYMPTOM_HINTS.test(low) && !/^\d+\s*тыс/i.test(t) && t.length < 180) {
      out.symptoms = normalizeSymptoms(t);
    }
  }

  return out;
}

function postProcessMerged(merged) {
  const out = { ...merged };
  if (out.symptoms) out.symptoms = normalizeSymptoms(String(out.symptoms));
  if (out.conditions) out.conditions = normalizeConditions(String(out.conditions));
  if (out.symptoms) out.category = detectSymptomCategory(String(out.symptoms));
  return out;
}

/**
 * @param {string} message
 * @param {Record<string, unknown>} currentState
 */
export async function extractConsultationData(message, currentState = {}) {
  const msg = String(message || '').trim();
  const base = mergeExtractedData(EMPTY_CONSULTATION_STATE, currentState);
  const pre = preExtractFromRules(msg, base);

  try {
    const raw = await chatCompletion({
      model: 'llama3.2',
      temperature: 0,
      messages: [
        { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
        { role: 'user', content: extractionUserPrompt(msg) },
      ],
    });
    const parsed = safeJsonParse(raw);
    const normalized = normalizeExtractedFromLlm(parsed || {});
    const mergedLlm = mergeExtractedData(pre, normalized);
    return postProcessMerged(mergedLlm);
  } catch {
    return postProcessMerged(pre);
  }
}

function parseFlowState(raw) {
  if (raw == null) return null;
  if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
    const asked = Array.isArray(raw.asked_questions) ? raw.asked_questions : [];
    let stage = 'clarification';
    if (raw.stage === 'result') stage = 'result';
    else if (raw.stage === 'service_result') stage = 'service_result';
    return {
      asked_questions: asked
        .filter((x) => x && typeof x === 'object')
        .map((x) => ({ field: String(x.field || ''), question: String(x.question || '') })),
      stage,
      intent: raw.intent === 'service' || raw.intent === 'diagnostic' ? raw.intent : null,
      service_type: typeof raw.service_type === 'string' && raw.service_type ? raw.service_type : null,
    };
  }
  return { asked_questions: [], stage: 'clarification', intent: null, service_type: null };
}

function pickAlternateQuestion(meta) {
  if (meta.field === 'conditions') {
    return { field: meta.field, question: ALT_FLOW_QUESTIONS.conditions };
  }
  return { field: meta.field, question: ALT_FLOW_QUESTIONS[meta.field] || meta.question };
}

function resolveQuestionAvoidingRepeat(meta, session, askedQuestions, _mergedState) {
  if (!meta) return null;
  if (shouldAskQuestion(session, meta, askedQuestions)) return meta;
  return pickAlternateQuestion(meta);
}

/**
 * Прогресс по шагам: марка, модель, пробег, запрос; для diagnostic — ещё условия.
 * @param {Record<string, unknown>} data
 */
export function progressFromConsultationSteps(data) {
  let n = 0;
  if (isFieldFilled('car_make', data.car_make)) n++;
  if (isFieldFilled('car_model', data.car_model)) n++;
  if (isFieldFilled('mileage', data.mileage)) n++;
  if (isFieldFilled('symptoms', data.symptoms)) n++;
  if (!isFieldFilled('symptoms', data.symptoms)) {
    return Math.min(100, Math.round((n / 4) * 100));
  }
  if (detectConsultationIntent(String(data.symptoms || '')) === 'service') {
    return Math.min(100, Math.round((n / 4) * 100));
  }
  const total = 5;
  if (isFieldFilled('conditions', data.conditions)) n++;
  return Math.min(100, Math.round((n / total) * 100));
}

/** @deprecated Используйте progressFromConsultationSteps */
export function progressFromMandatoryFields(data) {
  return progressFromConsultationSteps(data);
}

/** @deprecated Используйте progressFromConsultationSteps */
export function progressFromServiceFields(data) {
  return progressFromConsultationSteps(data);
}

/**
 * Итог планового обслуживания (все поля уже собраны в общем порядке).
 * @param {Record<string, unknown>} merged
 * @param {{ asked_questions: Array<{ field: string, question: string }>, stage: string, intent?: string | null, service_type?: string | null }} flow
 * @param {string} userMessage
 */
export function handleServiceRequest(merged, session, flow, userMessage) {
  void session;
  const src = String(merged.symptoms || userMessage || '');
  const stFromMsg = detectServiceType(src);
  if (stFromMsg !== 'unknown') merged.service_type = stFromMsg;
  else if (flow.service_type) merged.service_type = flow.service_type;
  else merged.service_type = merged.service_type || 'unknown';

  const st = String(merged.service_type || 'unknown');

  return {
    stage: 'service_result',
    service_type: st,
    assistant_message: serviceResultAssistantMessage(st),
    extracted_data: merged,
    diagnosis: null,
    missing_fields: [],
    flowState: {
      asked_questions: flow.asked_questions,
      stage: 'service_result',
      intent: 'service',
      service_type: st,
    },
  };
}

/**
 * @param {import('@prisma/client').ConsultationSession & { extracted?: import('@prisma/client').ExtractedDiagnosticData | null, messages?: import('@prisma/client').Message[] }} session
 * @param {string} userMessage
 */
export async function buildConsultationState(session, userMessage) {
  const flow =
    parseFlowState(session?.flowState) || {
      asked_questions: [],
      stage: 'clarification',
      intent: null,
      service_type: null,
    };

  const existing = {
    car_make: session?.extracted?.make ?? null,
    car_model: session?.extracted?.model ?? null,
    year: session?.extracted?.year ?? null,
    mileage: session?.extracted?.mileage ?? null,
    symptoms: session?.extracted?.symptoms ?? null,
    conditions: session?.extracted?.problemConditions ?? null,
    urgency_signs: null,
    category: null,
    intent: null,
    service_type: flow.service_type ?? null,
  };

  const extractedNew = await extractConsultationData(userMessage, existing);
  let merged = mergeExtractedData(existing, extractedNew);
  merged = postProcessMerged(merged);

  if (isFieldFilled('symptoms', merged.symptoms)) {
    const det = detectConsultationIntent(String(merged.symptoms));
    merged.intent = det === 'service' ? 'service' : 'diagnostic';
    if (merged.intent === 'service') {
      const st = detectServiceType(String(merged.symptoms));
      if (st !== 'unknown') merged.service_type = st;
      else if (flow.service_type) merged.service_type = flow.service_type;
    } else {
      merged.service_type = null;
    }
  } else {
    merged.intent = null;
    merged.service_type = null;
  }

  if (flow.stage === 'service_result' && merged.intent === 'service') {
    return handleServiceRequest(merged, session, flow, userMessage);
  }

  const missing = getMissingFields(merged);

  if (missing.length === 0) {
    if (merged.intent === 'service') {
      return handleServiceRequest(merged, session, flow, userMessage);
    }
    const { generateDiagnosis } = await import('../modules/consultations/consultationAi.service.js');
    const diagnosis = await generateDiagnosis(merged);
    return {
      stage: 'result',
      assistant_message: diagnosis.summary,
      extracted_data: merged,
      diagnosis,
      missing_fields: [],
      flowState: {
        asked_questions: flow.asked_questions,
        stage: 'result',
        intent: 'diagnostic',
        service_type: null,
      },
    };
  }

  const meta = getNextQuestion(merged);
  if (!meta) {
    throw new Error('consultationFlow: getNextQuestion returned null while mandatory fields are missing');
  }

  const resolved = resolveQuestionAvoidingRepeat(meta, session, flow.asked_questions, merged);
  const finalMeta = resolved || meta;
  const newAsked = [...flow.asked_questions, { field: finalMeta.field, question: finalMeta.question }];

  return {
    stage: 'clarification',
    assistant_message: finalMeta.question,
    extracted_data: merged,
    diagnosis: null,
    missing_fields: missing,
    flowState: {
      asked_questions: newAsked,
      stage: 'clarification',
      intent: merged.intent,
      service_type: merged.service_type,
    },
  };
}

export { BOOTSTRAP_ASSISTANT_MESSAGE } from '../config/consultationFlow.config.js';
