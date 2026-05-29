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
import {
  DIALOG_STEP_FORMAT_SCHEMA,
  DIALOG_STEP_SYSTEM_PROMPT,
  EXTRACTION_FORMAT_SCHEMA,
  EXTRACTION_SYSTEM_PROMPT,
  dialogStepUserPrompt,
  extractionUserPrompt,
} from '../prompts/consultationPrompts.js';
import {
  detectConsultationIntent,
  detectServiceType,
} from './consultationIntent.service.js';
import { getEnv } from '../config/env.js';
import { chatCompletion } from './llmService.js';
import { telemetryInc, telemetryObservePhase } from './diagnosticsTelemetry.service.js';

const EXTRACTION_FIELD_KEYS = [
  'car_make',
  'car_model',
  'year',
  'mileage',
  'symptoms',
  'conditions',
  'urgency_signs',
];

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

const DIALOG_REQUIRED_FIELDS = ['car_make', 'car_model', 'year', 'mileage', 'symptoms'];

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
 * Считаем симптом/запрос валидным только если в нём есть предметика, а не общая фраза.
 * @param {unknown} value
 */
export function isExplicitSymptomsText(value) {
  const s = String(value || '').trim();
  if (!s || s.length < 6) return false;
  const low = s.toLowerCase().replace(/\s+/g, ' ');

  // Плановые работы тоже считаем "явным запросом".
  if (
    /\b(то|техобслуж|обслужив|замен|масл|фильтр|колод|грм|антифриз|свеч|шиномонтаж|развал)\b/i.test(
      low,
    )
  ) {
    return true;
  }

  // Слишком общие ответы — невалидны для постановки диагноза.
  if (
    /^(диагностика|нужна диагностика|проверка|посмотрите|помогите|что[- ]?то не так|проблема|не знаю|подскажите)$/i.test(
      low,
    )
  ) {
    return false;
  }

  // Явные маркеры симптомов.
  if (SYMPTOM_HINTS.test(low)) return true;
  if (
    /(не\s+завод|не\s+едет|плохо\s+едет|есть\s+шум|посторонний\s+звук|вибраци|стук|глох|перегрев|дым|рев(е|ё)т|громк|гул|свист|скрежет|треск)/i.test(
      low,
    )
  ) {
    return true;
  }

  // Мягкий fallback: если текст осмысленный (2+ слова) и не "общая отписка" — считаем симптомом,
  // чтобы ИИ мог продолжить консультацию даже без совпадения по rule-based паттернам.
  const words = low
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean);
  const hasMeaningfulWords = words.length >= 2 && low.length >= 12;
  return hasMeaningfulWords;
}

/**
 * Недостающие поля: марка → модель → пробег → описание запроса → условия (только diagnostic).
 * @param {Record<string, unknown>} data
 */
export function getMissingFields(data) {
  const missing = DIALOG_REQUIRED_FIELDS.filter((k) => !isFieldFilled(k, data[k]));
  if (missing.length) return missing;
  if (!isExplicitSymptomsText(data.symptoms)) {
    return ['symptoms'];
  }
  if (detectConsultationIntent(String(data.symptoms || '')) === 'service') {
    return [];
  }
  if (!isFieldFilled('conditions', data.conditions)) {
    return ['conditions'];
  }
  return [];
}

function pickRecentAssistantMessages(messages = []) {
  return messages
    .filter((m) => m?.sender === 'ASSISTANT' && m?.content)
    .slice(-5)
    .map((m) => String(m.content));
}

function normalizeDialogDecision(raw, fallbackMissing) {
  const obj = raw && typeof raw === 'object' ? raw : {};
  const intent = ['diagnostic', 'service', 'unknown'].includes(String(obj.intent))
    ? String(obj.intent)
    : 'unknown';
  const missing_fields = Array.isArray(obj.missing_fields)
    ? obj.missing_fields
        .map((x) => String(x))
        .filter((x) => ['car_make', 'car_model', 'year', 'mileage', 'symptoms', 'conditions'].includes(x))
    : [];
  const next_question =
    obj.next_question == null ? null : String(obj.next_question).replace(/\s+/g, ' ').trim() || null;
  const completion_ready = Boolean(obj.completion_ready);
  const confidenceRaw = Number(obj.confidence);
  const confidence = Number.isFinite(confidenceRaw) ? Math.max(0, Math.min(1, confidenceRaw)) : 0;
  return {
    intent,
    missing_fields: missing_fields.length ? missing_fields : fallbackMissing,
    next_question,
    completion_ready,
    confidence,
  };
}

function looksLikeShortConditionsReply(message) {
  const t = String(message || '')
    .toLowerCase()
    .trim();
  if (!t || t.length > 80) return false;
  return /^(на\s+месте|только\s+на\s+месте|при\s+повороте|на\s+ходу|при\s+движении|всегда|постоянно|на\s+холодную|на\s+горячую|на\s+газ(у)?|при\s+нажатии\s+на\s+газ)\b/i.test(
    t,
  );
}

function applyDialogGuardrails({ decision, merged, flow, userMessage }) {
  const out = { ...decision, missing_fields: [...(decision?.missing_fields || [])] };
  const lastAsked = flow?.asked_questions?.length
    ? flow.asked_questions[flow.asked_questions.length - 1]
    : null;
  const hasSymptoms = isFieldFilled('symptoms', merged?.symptoms);
  const hasConditions = isFieldFilled('conditions', merged?.conditions);

  // Если симптом уже есть, не позволяем LLM снова требовать symptoms
  if (hasSymptoms) {
    out.missing_fields = out.missing_fields.filter((f) => f !== 'symptoms');
  }
  if (hasConditions) {
    out.missing_fields = out.missing_fields.filter((f) => f !== 'conditions');
  }

  // Не даем LLM "забыть" реально недостающие поля.
  const deterministicMissing = getMissingFields(merged);
  if (out.missing_fields.length === 0 && deterministicMissing.length > 0) {
    out.missing_fields = deterministicMissing;
  }

  // Если только что спрашивали условия и клиент дал короткий ответ про условия,
  // не перескакиваем обратно к symptoms даже если LLM запутался.
  if (
    lastAsked?.field === 'conditions' &&
    looksLikeShortConditionsReply(userMessage) &&
    hasSymptoms &&
    !hasConditions
  ) {
    out.missing_fields = ['conditions'];
    out.intent = merged?.intent || out.intent;
    if (!out.next_question || out.next_question.length < 6) {
      out.next_question = FLOW_QUESTIONS.conditions;
    }
  }

  // После нескольких попыток по одному полю прекращаем цикл и даем завершиться с текущими данными.
  const fieldAskCount = (field) =>
    (flow?.asked_questions || []).filter((q) => q.field === field).length;
  if (
    lastAsked?.field === 'conditions' &&
    String(userMessage || '').trim().length > 0 &&
    hasSymptoms &&
    fieldAskCount('conditions') >= 1
  ) {
    out.missing_fields = out.missing_fields.filter((f) => f !== 'conditions');
    out.completion_ready = true;
    telemetryInc('loopPreventions');
  }
  if (out.missing_fields.length === 1 && fieldAskCount(out.missing_fields[0]) >= MAX_ASKS_PER_FIELD) {
    out.missing_fields = [];
    out.completion_ready = true;
    telemetryInc('loopPreventions');
  }

  // Если для диагностики уже есть и symptoms, и conditions — можно завершать.
  if (out.missing_fields.length === 0 && hasSymptoms && (merged?.intent === 'service' || hasConditions)) {
    out.completion_ready = true;
  }

  return out;
}

async function planDialogStepWithLlm({ userMessage, merged, session, askedQuestions }) {
  const env = getEnv();
  const model = env.LLM_EXTRACTION_MODEL?.trim() || env.LLM_MODEL;
  const fallbackMissing = getMissingFields(merged);
  try {
    const startedAt = Date.now();
    const raw = await chatCompletion({
      model,
      temperature: 0,
      timeoutMs: 8_000,
      format: DIALOG_STEP_FORMAT_SCHEMA,
      messages: [
        { role: 'system', content: DIALOG_STEP_SYSTEM_PROMPT },
        {
          role: 'user',
          content: dialogStepUserPrompt({
            userMessage,
            extracted: merged,
            lastAssistantMessages: pickRecentAssistantMessages(session?.messages || []),
            askedQuestions: (askedQuestions || []).map((x) => String(x?.question || '')).filter(Boolean),
          }),
        },
      ],
    });
    const parsed = JSON.parse(raw);
    telemetryObservePhase('dialog', Date.now() - startedAt);
    const decision = normalizeDialogDecision(parsed, fallbackMissing);
    return applyDialogGuardrails({
      decision,
      merged,
      flow: { asked_questions: askedQuestions || [] },
      userMessage,
    });
  } catch {
    const decision = normalizeDialogDecision(null, fallbackMissing);
    return applyDialogGuardrails({
      decision,
      merged,
      flow: { asked_questions: askedQuestions || [] },
      userMessage,
    });
  }
}

/**
 * @param {string} text
 */
export function normalizeConditions(text) {
  const src = String(text || '').trim();
  if (!src) return src;
  const low = src.toLowerCase();
  if (
    /((на\s+месте|стоит|при\s+стоянке).*(при\s+движении|едет|в\s+движении))|((при\s+движении|едет|в\s+движении).*(на\s+месте|стоит|при\s+стоянке))/i.test(
      low,
    )
  ) {
    return 'и на месте, и при движении';
  }
  if (/(когда\s+машина\s+стоит|при\s+стоянке|на\s+месте)/i.test(low)) return 'на месте';
  if (/(когда\s+машина\s+едет|при\s+езде|в\s+движении)/i.test(low)) return 'при движении';

  const map = [
    [/на\s+ходу/i, 'при движении'],
    [/при\s+езде/i, 'при движении'],
    [/при\s+движении/i, 'при движении'],
    [/при\s+запуске/i, 'при запуске двигателя'],
    [/на\s+холодную/i, 'на холодную'],
    [/на\s+горячую/i, 'на горячую'],
    [/при\s+торможении/i, 'при торможении'],
    [/на\s+кочках/i, 'на неровной дороге'],
    [/на\s+скорости/i, 'на скорости'],
    [/при\s+разгоне/i, 'при разгоне'],
    [/при\s+нажатии\s+на\s+газ/i, 'при разгоне'],
    [/на\s+газу/i, 'при разгоне'],
    [/на\s+газ/i, 'при разгоне'],
    [/при\s+повороте/i, 'при повороте'],
    [/на\s+месте/i, 'на месте'],
    [/на\s+холостом/i, 'на холостом ходу'],
    [/после\s+прогрева/i, 'после прогрева'],
    [/в\s+пробк(е|ах)/i, 'в пробке'],
    [/по\s+пробк(ам|е)/i, 'в пробке'],
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
  if (low.includes('при езде')) return 'при движении';
  if (/\bедет\b/.test(low)) return 'при движении';
  if (/\bстоит\b/.test(low)) return 'на месте';
  if (low.includes('на газ')) return 'при разгоне';
  return out;
}

function inferConditionsFromReply(message, state = {}) {
  const raw = String(message || '').trim();
  if (!raw) return null;

  const universal = tryExtractUniversalConditionAnswer(raw, state);
  if (universal) return universal;

  const low = raw.toLowerCase();
  const hasSymptoms = isFieldFilled('symptoms', state?.symptoms);
  const contextHint =
    CONDITION_HINTS.test(low) ||
    /(когда|если|при|после|до|во\s+время|только|всегда|постоянно|иногда|периодически)/i.test(low);
  if (!contextHint || (!hasSymptoms && raw.length < 25)) return null;

  const normalized = normalizeConditions(raw).replace(/\s+/g, ' ').trim();
  return normalized.length > 1 ? normalized.slice(0, 180) : null;
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
    [/гре(ет|ется|юсь|емся)\s+двигател/i, 'перегрев двигателя'],
    [/двигател\w*\s+гре(ет|ется|юсь|емся)/i, 'перегрев двигателя'],
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
  if (!isFieldFilled('year', data.year)) {
    return { field: 'year', question: 'Укажите год выпуска автомобиля.' };
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
  const normalizeQuestionKey = (q) =>
    String(q || '')
      .toLowerCase()
      .replace(/[!?.,:;()[\]"]/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/пожалуйста/g, '')
      .replace(/уточните/g, 'укажите')
      .replace(/подскажите/g, 'укажите')
      .replace(/какой\s+именно/g, 'какой')
      .trim();

  const isSameMeaning = (a, b) => {
    const x = normalizeQuestionKey(a);
    const y = normalizeQuestionKey(b);
    if (!x || !y) return false;
    return x === y || x.includes(y) || y.includes(x);
  };

  const lastAssistant = getLastAssistantContent(session?.messages || []);
  if (lastAssistant && questionMeta?.question && isSameMeaning(lastAssistant, questionMeta.question)) {
    return false;
  }
  if (
    askedQuestions.some((x) => x.question && questionMeta?.question && isSameMeaning(x.question, questionMeta.question))
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
 * Отсекает мусор в марке после LLM.
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

  if (letters < 2) {
    return letters === 1 && hasDigit;
  }

  const vowels = (v.match(/[aeiouyаеёиоуыэюя]/gi) || []).length;
  if (letters >= 4 && vowels === 0 && !hasDigit) return false;

  return true;
}

/**
 * Более мягкая валидация для модели: допускает чисто числовые названия
 * (Mazda 3, Mazda 6, Peugeot 208, BMW 320, Fiat 500, Porsche 911).
 * @param {unknown} value
 */
export function isValidModelText(value) {
  if (!value || typeof value !== 'string') return false;
  const v = value.trim();
  if (!v.length || v.length > 25) return false;
  if (/[^a-zA-Zа-яА-Я0-9\-\s]/.test(v)) return false;
  if (/^[0-9]+$/.test(v)) return v.length <= 4;
  return isValidVehicleText(value);
}

/**
 * Удаляет обрамляющую пунктуацию и служебные символы вокруг токена модели.
 * Пример: "3," -> "3", "(CX-5)" -> "CX-5".
 * @param {unknown} value
 */
function sanitizeModelToken(value) {
  if (value == null) return '';
  return String(value)
    .trim()
    .replace(/^[^a-zA-Zа-яА-Я0-9]+/, '')
    .replace(/[^a-zA-Zа-яА-Я0-9]+$/, '');
}

/**
 * Слова-маркеры, которые не могут быть моделью авто.
 * @param {string} token
 */
function isModelStopWord(token) {
  return /^(пробег|км|тыс|год|года|двигатель|мотор|неисправность|симптомы|симптом)$/i.test(token);
}

/**
 * Маркерные слова, которые больше похожи на симптом, чем на марку.
 * @param {string} token
 */
function isLikelySymptomToken(token) {
  return /^(стук|шум|гул|свист|скрежет|треск|дым|троит|глохнет|перегрев|течет|утечка|масло|чек|ошибка)$/i.test(
    token,
  );
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
    car_model: isValidModelText(obj.car_model) ? text(obj.car_model) : null,
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
  const groupedNumber = '(?:\\d{1,3}(?:[\\s.,]\\d{3}){1,3}|\\d{4,7})';
  let m =
    t.match(new RegExp(`(${groupedNumber})\\s*(?:км)?\\s*пробег`, 'i')) ||
    t.match(new RegExp(`пробег\\D{0,12}(${groupedNumber})`, 'i')) ||
    t.match(/(\d{2,3})\s*тыс(?:\s*км)?/i) ||
    t.match(/(\d{3,7})\s*км/i) ||
    t.match(/\b(\d{4,7})\b(?!\s*год)/i);
  if (!m) return null;
  const raw = String(m[1]).replace(/[.,\s]+/g, '');
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  if (n >= 1950 && n <= 2035 && /\b(19|20)\d{2}\b/.test(raw)) return null;
  if (/тыс/i.test(t) || (/пробег/i.test(low) && n < 1000)) return n * 1000;
  if (n >= 1000 && n < 1000000) return n;
  return n;
}

function extractYearRegex(t) {
  const m = t.match(/\b(19[7-9]\d|20[0-3]\d)\b/);
  return m ? Number(m[1]) : null;
}

const CONDITION_HINTS =
  /при\s+(движении|езде|запуске|торможении|разгоне|повороте|нажатии\s+на\s+газ)|на\s+(холодную|горячую|ходу|кочках|скорости|месте|газу)|на\s+газ|на\s+холост|после\s+прогрева|в\s+пробк(е|ах)|по\s+пробк(ам|е)|выключен\w*\s+(мотор|двигател)\w*|на\s+выключенном|мотор\s+выключен|двигател\w*\s+выключен|engine\s+off|заглушен\w*\s+(мотор|двигател)\w*|когда\s+машина\s+(стоит|едет)|\b(стоит|едет)\b|в\s+движении|при\s+стоянке|из[-\s]*под\s+капот/i;

/**
 * Ответы вроде «всегда» на вопрос про условия — rule-based, т.к. LLM часто даёт conditions: null.
 * @param {string} message
 * @param {Record<string, unknown>} base merged state (должны быть симптомы диагностики)
 * @returns {string|null}
 */
export function tryExtractUniversalConditionAnswer(message, base) {
  const s = base?.symptoms != null ? String(base.symptoms).trim() : '';
  if (!s || detectConsultationIntent(s) === 'service') return null;
  const raw = String(message || '').trim();
  if (!raw || raw.length > 120) return null;
  const low = raw.toLowerCase().replace(/\s+/g, ' ');

  if (/^(всегда|always|постоянно|неизменно)$/i.test(raw)) {
    return 'постоянно, в любых условиях';
  }
  if (
    /^(в\s+любое\s+время|в\s+любых\s+условиях|не\s+зависит(\s+от\s+условий)?|anytime|all\s+the\s+time|at\s+all\s+times)$/i.test(
      low,
    )
  ) {
    return 'постоянно, в любых условиях';
  }
  return null;
}

const SYMPTOM_HINTS =
  /пропуск|троит|оборот|стук|скрип|вибрац|тормож|рывк|подергив|дым|перегрев|гре(ет|ется)|температур|кипит|запуск|глох|биение|плава|чек|короб|передач|переключен|рул|подвеск|старт|рев(е|ё)т|громк|гул|свист|скрежет|треск|шум/i;

function stripVehicleIntroFromSymptomText(text, extracted) {
  let s = String(text || '').trim();
  if (!s) return s;
  const esc = (x) => String(x).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const make = String(extracted?.car_make || '').trim();
  const model = String(extracted?.car_model || '').trim();
  const year = Number(extracted?.year);
  const mileage = Number(extracted?.mileage);

  if (make) s = s.replace(new RegExp(`\\b${esc(make)}\\b`, 'i'), ' ');
  if (model) s = s.replace(new RegExp(`\\b${esc(model)}\\b`, 'i'), ' ');
  if (Number.isFinite(year)) s = s.replace(new RegExp(`\\b${year}\\b`, 'g'), ' ');
  if (Number.isFinite(mileage)) s = s.replace(new RegExp(`\\b${mileage}\\b`, 'g'), ' ');
  s = s.replace(/\bпробег\b/gi, ' ');
  s = s.replace(/[,:;]+/g, ' ').replace(/\s+/g, ' ').trim();
  return s;
}

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
  const compact = t
    .replace(/[，,;:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const y = extractYearRegex(t);
  if (y && !out.year) out.year = y;

  const mileage = extractMileageRegex(t);
  if (mileage != null) out.mileage = mileage;

  if (!out.car_make || !out.car_model) {
    const MAKE_PATTERNS = [
      { rx: /^(?:бмв|bmw)(?:\s+(.+))?$/i, make: 'BMW' },
      { rx: /^(?:мазда|mazda)(?:\s+(.+))?$/i, make: 'Mazda' },
      { rx: /^(?:тойота|toyota)(?:\s+(.+))?$/i, make: 'Toyota' },
      { rx: /^(?:хонда|honda)(?:\s+(.+))?$/i, make: 'Honda' },
      { rx: /^(?:ниссан|nissan)(?:\s+(.+))?$/i, make: 'Nissan' },
      { rx: /^(?:хёндай|хендай|хюндай|hyundai)(?:\s+(.+))?$/i, make: 'Hyundai' },
      { rx: /^(?:киа|kia)(?:\s+(.+))?$/i, make: 'Kia' },
      { rx: /^(?:мерседес|mercedes|мерс)(?:\s+(.+))?$/i, make: 'Mercedes-Benz' },
      { rx: /^(?:ауди|audi)(?:\s+(.+))?$/i, make: 'Audi' },
      { rx: /^(?:фольксваген|volkswagen|vw|фольц)(?:\s+(.+))?$/i, make: 'Volkswagen' },
      { rx: /^(?:шкода|skoda)(?:\s+(.+))?$/i, make: 'Skoda' },
      { rx: /^(?:форд|ford)(?:\s+(.+))?$/i, make: 'Ford' },
      { rx: /^(?:шевроле|chevrolet)(?:\s+(.+))?$/i, make: 'Chevrolet' },
      { rx: /^(?:рено|renault)(?:\s+(.+))?$/i, make: 'Renault' },
      { rx: /^(?:пежо|peugeot)(?:\s+(.+))?$/i, make: 'Peugeot' },
      { rx: /^(?:ситроен|citroen)(?:\s+(.+))?$/i, make: 'Citroen' },
      { rx: /^(?:лада|ваз|vaz|lada)(?:\s+(.+))?$/i, make: 'Lada' },
      { rx: /^(?:субару|subaru)(?:\s+(.+))?$/i, make: 'Subaru' },
      { rx: /^(?:мицубиси|митсубиси|mitsubishi)(?:\s+(.+))?$/i, make: 'Mitsubishi' },
      { rx: /^(?:лексус|lexus)(?:\s+(.+))?$/i, make: 'Lexus' },
      { rx: /^(?:вольво|volvo)(?:\s+(.+))?$/i, make: 'Volvo' },
      { rx: /^(?:сузуки|suzuki)(?:\s+(.+))?$/i, make: 'Suzuki' },
      { rx: /^(?:опель|opel)(?:\s+(.+))?$/i, make: 'Opel' },
      { rx: /^(?:порше|porsche)(?:\s+(.+))?$/i, make: 'Porsche' },
      { rx: /^(?:фиат|fiat)(?:\s+(.+))?$/i, make: 'Fiat' },
      { rx: /^(?:джили|geely)(?:\s+(.+))?$/i, make: 'Geely' },
      { rx: /^(?:чери|chery)(?:\s+(.+))?$/i, make: 'Chery' },
      { rx: /^(?:хавал|haval)(?:\s+(.+))?$/i, make: 'Haval' },
    ];
    for (const { rx, make } of MAKE_PATTERNS) {
      const m = compact.match(rx);
      if (m) {
        if (!out.car_make) out.car_make = make;
        if (!out.car_model) {
          const rest = String(m[1] || '')
            .trim()
            .split(/\s+/)[0];
          const modelCandidate = sanitizeModelToken(rest);
          if (modelCandidate && !isModelStopWord(modelCandidate) && isValidModelText(modelCandidate)) {
            out.car_model = modelCandidate;
          }
        }
        break;
      }
    }
  }

  // Эвристика: первое слово в полной реплике (особенно рядом с годом/пробегом) часто и есть марка.
  if (!out.car_make) {
    const firstRaw = String(compact.split(/\s+/)[0] || '');
    const firstToken = sanitizeModelToken(firstRaw);
    const hasContextNums = extractYearRegex(t) != null || extractMileageRegex(t) != null;
    if (
      firstToken &&
      hasContextNums &&
      isValidVehicleText(firstToken) &&
      !isModelStopWord(firstToken) &&
      !isLikelySymptomToken(firstToken)
    ) {
      out.car_make = firstToken;
    }
  }

  // Ответ на «уточните марку»: одно слово при неизвестной марке.
  if (!out.car_make && compact.length <= 28 && !/\d{4,}/.test(compact)) {
    const token = sanitizeModelToken(compact.split(/\s+/)[0]);
    if (
      token &&
      isValidVehicleText(token) &&
      !isModelStopWord(token) &&
      !isLikelySymptomToken(token) &&
      !/^(тыс|км|пробег|год|года)$/i.test(token)
    ) {
      out.car_make = token;
    }
  }

  // Ответ на «уточните модель»: одно слово при уже известной марке
  if (out.car_make && !out.car_model && compact.length <= 28 && !/\d{4,}/.test(compact)) {
    const token = sanitizeModelToken(compact.split(/\s+/)[0]);
    if (token && !isModelStopWord(token) && isValidModelText(token) && !/^(тыс|км|пробег)$/i.test(token)) {
      out.car_model = token;
    }
  }

  if (!out.conditions) {
    const universal = tryExtractUniversalConditionAnswer(t, out);
    if (universal) {
      out.conditions = universal;
    } else if (CONDITION_HINTS.test(t)) {
      const c = normalizeConditions(t);
      if (c && c.length > 2) out.conditions = c;
    }
  }

  if (!out.symptoms) {
    if (SYMPTOM_HINTS.test(low) && !/^\d+\s*тыс/i.test(t) && t.length < 180) {
      out.symptoms = normalizeSymptoms(t);
    }
  }

  // Мягкий fallback: если пришло осмысленное описание (даже без словаря rules),
  // записываем его как symptoms, чтобы не зацикливать вопрос.
  if (!out.symptoms && !isSimpleExtractionMessage(t) && t.length >= 12 && t.length <= 220) {
    const candidate = stripVehicleIntroFromSymptomText(t, out);
    const words = candidate.split(/\s+/).filter(Boolean);
    const looksOnlyLikeConditions = CONDITION_HINTS.test(candidate) && words.length <= 6;
    if (!looksOnlyLikeConditions && words.length >= 2) {
      out.symptoms = normalizeSymptoms(candidate);
    }
  }

  // Частый кейс утечек, который может не пройти через текущий SYMPTOM_HINTS.
  if (!out.symptoms && /(теч|вытек|подтека|лужа|капает)/i.test(low) && /(масл|антифриз|охлажда|жидк)/i.test(low)) {
    out.symptoms = /масл/i.test(low) ? 'утечка масла' : 'утечка технической жидкости';
  }

  // Плановое ТО / замены: фразы вроде «замена масла» не попадают под SYMPTOM_HINTS, а LLM может не вернуть поле
  if (!out.symptoms && t.length >= 2 && t.length < 300) {
    const intent = detectConsultationIntent(t);
    if (intent === 'service') {
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
 * LLM часто сжимает фразу до «ДВС» / одного слова — теряется «замена масла», и поток уходит в диагностику.
 * Если rule-based уже распознал плановое ТО, не даём ответу LLM это сломать.
 * @param {Record<string, unknown>} pre
 * @param {Record<string, unknown>} merged
 */
/**
 * Сколько полей rule-based слой добавил или уточнил относительно base.
 * @param {Record<string, unknown>} base
 * @param {Record<string, unknown>} pre
 */
export function countFieldsChangedByPre(base, pre) {
  let n = 0;
  for (const key of EXTRACTION_FIELD_KEYS) {
    const had = isFieldFilled(key, base[key]);
    const now = isFieldFilled(key, pre[key]);
    if (!now) continue;
    if (!had || String(pre[key]).trim() !== String(base[key] ?? '').trim()) n++;
  }
  return n;
}

/**
 * Короткий ответ на один вопрос бота (пробег, год, «всегда») — LLM не нужен.
 * @param {string} message
 */
export function isSimpleExtractionMessage(message) {
  const t = String(message || '').trim();
  if (!t) return true;
  if (t.length > 80) return false;
  if (/^\d{4,7}(\s*км)?$/i.test(t)) return true;
  if (/^\d{1,3}\s*тыс(?:\s*км)?\.?$/i.test(t)) return true;
  if (/^(19|20)\d{2}$/.test(t)) return true;
  if (/^(всегда|always|постоянно|неизменно)$/i.test(t)) return true;
  if (
    /^(в\s+любое\s+время|в\s+любых\s+условиях|не\s+зависит(\s+от\s+условий)?)$/i.test(
      t.toLowerCase(),
    )
  ) {
    return true;
  }
  if (CONDITION_HINTS.test(t) && t.length <= 60) return true;
  return false;
}

/**
 * Пропускаем вызов LLM, если правила уже разобрали сообщение.
 * @param {string} message
 * @param {Record<string, unknown>} base
 * @param {Record<string, unknown>} pre
 */
export function shouldSkipLlmExtraction(message, base, pre) {
  const msg = String(message || '').trim();
  if (!msg) return true;
  if (isSimpleExtractionMessage(msg)) return true;

  const hadMake = isFieldFilled('car_make', base?.car_make);
  const hasMakeNow = isFieldFilled('car_make', pre?.car_make);
  if (!hadMake && !hasMakeNow) {
    // Для марок вне локального словаря (например Changan) всегда даем шанс LLM.
    return false;
  }

  const hadSymptoms = isFieldFilled('symptoms', base?.symptoms);
  const hasSymptomsNow = isFieldFilled('symptoms', pre?.symptoms);
  if (!hadSymptoms && !hasSymptomsNow) {
    // Если rules не извлекли симптомы, даём шанс LLM дособрать смысл.
    return false;
  }

  const delta = countFieldsChangedByPre(base, pre);
  if (delta >= 2) return true;
  if (delta > 0 && msg.length <= 140) return true;

  return false;
}

function applyLastAskedFieldHint(merged, flow, userMessage) {
  const out = { ...merged };
  const lastAsked = flow?.asked_questions?.length ? flow.asked_questions[flow.asked_questions.length - 1] : null;
  const reply = String(userMessage || '').trim();
  if (!lastAsked?.field || !reply) return out;

  const token = sanitizeModelToken(reply.split(/\s+/)[0] || '');
  const isSingleToken = reply.split(/\s+/).filter(Boolean).length === 1;

  if (lastAsked.field === 'car_make' && !isFieldFilled('car_make', out.car_make)) {
    if (isSingleToken && token && isValidVehicleText(token) && !isModelStopWord(token) && !isLikelySymptomToken(token)) {
      out.car_make = token;
      return out;
    }
  }

  if (lastAsked.field === 'car_model' && !isFieldFilled('car_model', out.car_model)) {
    if (isSingleToken && token && isValidModelText(token) && !isModelStopWord(token)) {
      out.car_model = token;
      return out;
    }
  }

  if (lastAsked.field === 'conditions' && !isFieldFilled('conditions', out.conditions)) {
    const inferred = inferConditionsFromReply(reply, out);
    if (inferred) out.conditions = inferred;
  }

  return out;
}

export function preferPreExtractedServiceSymptoms(pre, merged) {
  const p = pre?.symptoms != null ? String(pre.symptoms).trim() : '';
  if (!p || detectConsultationIntent(p) !== 'service') return merged;
  const m = merged?.symptoms != null ? String(merged.symptoms).trim() : '';
  if (!m) return { ...merged, symptoms: pre.symptoms };
  if (detectConsultationIntent(m) === 'service') return merged;
  return { ...merged, symptoms: pre.symptoms };
}

/**
 * @param {string} message
 * @param {Record<string, unknown>} currentState
 */
export async function extractConsultationData(message, currentState = {}) {
  const msg = String(message || '').trim();
  const base = mergeExtractedData(EMPTY_CONSULTATION_STATE, currentState);
  const pre = preExtractFromRules(msg, base);

  if (shouldSkipLlmExtraction(msg, base, pre)) {
    return postProcessMerged(pre);
  }

  const env = getEnv();
  const extractionModel = env.LLM_EXTRACTION_MODEL?.trim() || env.LLM_MODEL;

  try {
    const raw = await chatCompletion({
      model: extractionModel,
      temperature: 0,
      timeoutMs: 10_000,
      keepAlive: env.LLM_KEEP_ALIVE,
      format: EXTRACTION_FORMAT_SCHEMA,
      options: {
        num_predict: env.LLM_EXTRACTION_NUM_PREDICT,
        num_ctx: 2048,
      },
      messages: [
        { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
        { role: 'user', content: extractionUserPrompt(msg, pre) },
      ],
    });
    const parsed = JSON.parse(raw);
    const normalized = normalizeExtractedFromLlm(parsed || {});
    const mergedLlm = preferPreExtractedServiceSymptoms(pre, mergeExtractedData(pre, normalized));
    return postProcessMerged(mergedLlm);
  } catch {
    return postProcessMerged(pre);
  }
}

/**
 * Генерирует контекстный follow-up вопрос через LLM (plain text, не JSON),
 * чтобы диалог не был жестко шаблонным при неполных симптомах.
 * @param {{
 *   userMessage: string,
 *   merged: Record<string, unknown>,
 *   nextField: string,
 *   fallbackQuestion: string,
 * }} params
 * @returns {Promise<string | null>}
 */
async function generateContextualFollowupQuestion({
  userMessage,
  merged,
  nextField,
  fallbackQuestion,
}) {
  const msg = String(userMessage || '').trim();
  if (!msg) return null;

  const env = getEnv();
  const model = env.LLM_EXTRACTION_MODEL?.trim() || env.LLM_MODEL;
  const stateSummary = {
    car_make: merged.car_make ?? null,
    car_model: merged.car_model ?? null,
    mileage: merged.mileage ?? null,
    symptoms: merged.symptoms ?? null,
    conditions: merged.conditions ?? null,
    intent: merged.intent ?? null,
  };

  try {
    const raw = await chatCompletion({
      model,
      temperature: 0.2,
      timeoutMs: 7_000,
      messages: [
        {
          role: 'system',
          content:
            'Ты ассистент автосервиса. Сформулируй ОДИН короткий уточняющий вопрос на русском по контексту клиента. Без JSON, без списков, без кавычек, только текст вопроса.',
        },
        {
          role: 'user',
          content:
            `Реплика клиента: ${msg}\n` +
            `Уже извлечено: ${JSON.stringify(stateSummary)}\n` +
            `Нужно уточнить поле: ${nextField}\n` +
            `Шаблон по умолчанию: ${fallbackQuestion}\n` +
            'Сделай вопрос максимально по смыслу реплики клиента.',
        },
      ],
    });
    const question = String(raw || '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!question || question.length > 240) return null;
    return question;
  } catch {
    return null;
  }
}

/**
 * Для поля symptoms используем фиксированный вопрос.
 * Иначе LLM иногда уходит в частные уточнения (например "оригинал/аналог"),
 * и пользовательский ответ перестаёт содержать сам запрос.
 * @param {{ field: string }} questionMeta
 */
export function shouldUseContextualFollowupQuestion(questionMeta) {
  // В проде такие вопросы иногда уходят в технические детали, которые клиент не обязан знать.
  // Оставляем детерминированные вопросы из flow-конфига.
  return false;
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
  const alt = pickAlternateQuestion(meta);
  if (shouldAskQuestion(session, alt, askedQuestions)) return alt;
  return alt;
}

const MAX_ASKS_PER_FIELD = 2;

function hasMinimumDataForDiagnosis(data) {
  if (!isFieldFilled('car_make', data?.car_make)) return false;
  if (!isFieldFilled('car_model', data?.car_model)) return false;
  if (!isFieldFilled('year', data?.year)) return false;
  if (!isFieldFilled('mileage', data?.mileage)) return false;
  if (!isFieldFilled('symptoms', data?.symptoms)) return false;
  if (detectConsultationIntent(String(data?.symptoms || '')) === 'service') return true;
  return isFieldFilled('conditions', data?.conditions);
}

/**
 * Прогресс по шагам: марка, модель, пробег, запрос; для diagnostic — ещё условия.
 * @param {Record<string, unknown>} data
 */
export function progressFromConsultationSteps(data) {
  let n = 0;
  if (isFieldFilled('car_make', data.car_make)) n++;
  if (isFieldFilled('car_model', data.car_model)) n++;
  if (isFieldFilled('year', data.year)) n++;
  if (isFieldFilled('mileage', data.mileage)) n++;
  if (isFieldFilled('symptoms', data.symptoms)) n++;
  if (!isFieldFilled('symptoms', data.symptoms)) {
    return Math.min(100, Math.round((n / 5) * 100));
  }
  if (detectConsultationIntent(String(data.symptoms || '')) === 'service') {
    return Math.min(100, Math.round((n / 5) * 100));
  }
  const total = 6;
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
 * @param {import('@prisma/client').ConsultationSession & { extracted?: import('@prisma/client').ExtractedDiagnosticData | null, messages?: import('@prisma/client').Message[] }} session
 * @param {string} userMessage
 * @param {((event: {phase: string, data?: unknown}) => void) | undefined} onProgress
 */
export async function buildConsultationState(session, userMessage, onProgress) {
  const turnStartedAt = Date.now();
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

  onProgress?.({ phase: 'extracting' });
  const extractStartedAt = Date.now();
  const extractedNew = await extractConsultationData(userMessage, existing);
  let merged = mergeExtractedData(existing, extractedNew);
  merged = postProcessMerged(merged);
  merged = applyLastAskedFieldHint(merged, flow, userMessage);
  telemetryObservePhase('extracting', Date.now() - extractStartedAt);
  onProgress?.({ phase: 'extracted', data: merged });

  const env = getEnv();
  const useLlmFirstFlow = env.CONSULTATION_FLOW_MODE === 'llm_first';
  const deadlineAtMs = turnStartedAt + Number(env.DIAGNOSIS_TURN_BUDGET_MS || 35_000);
  const remainingBudgetMs = () => Math.max(0, deadlineAtMs - Date.now());

  let llmDialog = null;
  if (useLlmFirstFlow && remainingBudgetMs() > Math.max(1500, Number(env.DIAGNOSIS_MIN_REMAINING_MS || 6000) / 2)) {
    llmDialog = await planDialogStepWithLlm({
      userMessage,
      merged,
      session,
      askedQuestions: flow.asked_questions,
    });
    merged.intent = llmDialog.intent === 'unknown' ? null : llmDialog.intent;
  } else if (useLlmFirstFlow) {
    telemetryInc('budgetCutoffs');
  } else if (isFieldFilled('symptoms', merged.symptoms) && isExplicitSymptomsText(merged.symptoms)) {
    const det = detectConsultationIntent(String(merged.symptoms));
    merged.intent = det === 'service' ? 'service' : 'diagnostic';
  } else {
    merged.intent = null;
  }
  if (!isExplicitSymptomsText(merged.symptoms)) {
    merged.intent = null;
  }

  if (merged.intent === 'service') {
    const st = detectServiceType(String(merged.symptoms || ''));
    if (st !== 'unknown') merged.service_type = st;
    else if (flow.service_type) merged.service_type = flow.service_type;
  } else {
    merged.service_type = null;
  }

  if (flow.stage === 'result' || flow.stage === 'service_result') {
    return {
      stage: flow.stage,
      assistant_message: 'Консультация завершена. Нажмите «Новая сессия» для нового запроса.',
      extracted_data: merged,
      diagnosis: null,
      missing_fields: [],
      flowState: flow,
    };
  }

  // Приоритет детерминированного состояния, чтобы LLM не переспрашивал уже покрытые поля.
  let missing = getMissingFields(merged);

  const fieldAskCount = (field) =>
    flow.asked_questions.filter((q) => q.field === field).length;
  // Никогда не "сдаемся" по базовым полям, иначе отчет строится из воздуха.
  const skippableFields = new Set(['conditions']);
  const exhausted = missing.filter((f) => skippableFields.has(f) && fieldAskCount(f) >= MAX_ASKS_PER_FIELD);
  if (exhausted.length) {
    missing = missing.filter((f) => !exhausted.includes(f));
    if (exhausted.includes('conditions') && !isFieldFilled('conditions', merged.conditions)) {
      const inferred = inferConditionsFromReply(userMessage, merged) || normalizeConditions(userMessage);
      if (inferred && inferred.length > 1) merged.conditions = inferred;
      missing = getMissingFields(merged);
    }
  }

  // Anti-loop: если symptoms уже спрашивали несколько раз и пользователь всё же дал описание,
  // прекращаем дублировать один и тот же вопрос.
  if (
    missing.includes('symptoms') &&
    fieldAskCount('symptoms') >= MAX_ASKS_PER_FIELD &&
    isFieldFilled('symptoms', merged.symptoms)
  ) {
    missing = missing.filter((f) => f !== 'symptoms');
    telemetryInc('loopPreventions');
  }

  const shouldComplete =
    missing.length === 0 &&
    hasMinimumDataForDiagnosis(merged) &&
    (!useLlmFirstFlow ||
      llmDialog?.completion_ready === true ||
      exhausted.length > 0 ||
      (llmDialog?.intent === 'service' && isFieldFilled('symptoms', merged.symptoms)) ||
      (merged.intent === 'diagnostic' && isFieldFilled('conditions', merged.conditions)));

  if (shouldComplete) {
    onProgress?.({ phase: 'diagnosing' });
    const { generateDiagnosis } = await import('../modules/consultations/consultationAi.service.js');
    const diagnosis = await generateDiagnosis(merged, {
      timeBudgetMs: Number(env.DIAGNOSIS_TURN_BUDGET_MS || 35_000),
      deadlineAtMs,
      onProgress,
    });

    const isService = merged.intent === 'service';
    const st = isService ? detectServiceType(String(merged.symptoms || '')) : null;

    return {
      stage: 'result',
      assistant_message: diagnosis.summary + '\n\nВы можете сохранить отчёт и оформить заявку в сервис.',
      extracted_data: merged,
      diagnosis,
      missing_fields: [],
      service_type: st || merged.service_type || null,
      flowState: {
        asked_questions: flow.asked_questions,
        stage: 'result',
        intent: merged.intent || 'diagnostic',
        service_type: st || merged.service_type || null,
        decision_path: {
          mode: useLlmFirstFlow ? 'llm_first' : 'hybrid',
          completion_reason: 'ready_for_diagnosis',
          budget_remaining_ms: remainingBudgetMs(),
        },
      },
    };
  }

  const llmField = (missing[0] && String(missing[0])) || 'symptoms';
  const llmMeta =
    useLlmFirstFlow && missing.length > 0 && llmDialog?.next_question
      ? { field: llmField, question: llmDialog.next_question }
      : null;

  const meta =
    llmMeta ||
    getNextQuestion({ ...merged, ...Object.fromEntries(exhausted.map((f) => [f, '__skip__'])) });
  if (!meta && hasMinimumDataForDiagnosis(merged)) {
    onProgress?.({ phase: 'diagnosing' });
    const { generateDiagnosis } = await import('../modules/consultations/consultationAi.service.js');
    const diagnosis = await generateDiagnosis(merged, {
      timeBudgetMs: Number(env.DIAGNOSIS_TURN_BUDGET_MS || 35_000),
      deadlineAtMs,
      onProgress,
    });
    return {
      stage: 'result',
      assistant_message: diagnosis.summary + '\n\nВы можете сохранить отчёт и оформить заявку в сервис.',
      extracted_data: merged,
      diagnosis,
      missing_fields: [],
      service_type: merged.service_type || null,
      flowState: {
        asked_questions: flow.asked_questions,
        stage: 'result',
        intent: merged.intent || 'diagnostic',
        service_type: merged.service_type || null,
      },
    };
  }
  if (!meta) {
    // Защита от преждевременного завершения: продолжаем сбор обязательных полей.
    const fallbackMeta = getNextQuestion(merged) || { field: 'symptoms', question: FLOW_QUESTIONS.symptoms };
    const newAsked = [...flow.asked_questions, { field: fallbackMeta.field, question: fallbackMeta.question }];
    return {
      stage: 'clarification',
      assistant_message: fallbackMeta.question,
      extracted_data: merged,
      diagnosis: null,
      missing_fields: getMissingFields(merged),
      flowState: {
        asked_questions: newAsked,
        stage: 'clarification',
        intent: merged.intent,
        service_type: merged.service_type,
        decision_path: {
          mode: useLlmFirstFlow ? 'llm_first' : 'hybrid',
          next_field: fallbackMeta.field,
          used_llm_dialog: Boolean(llmMeta),
          budget_remaining_ms: remainingBudgetMs(),
        },
      },
    };
  }

  const resolved = resolveQuestionAvoidingRepeat(meta, session, flow.asked_questions, merged);
  const finalMeta = resolved || meta;
  let assistantQuestion = finalMeta.question;
  // При неполном описании проблемы используем контекстный follow-up от LLM (plain text).
  if (shouldUseContextualFollowupQuestion(finalMeta) && !(useLlmFirstFlow && llmMeta)) {
    const contextualQuestion = await generateContextualFollowupQuestion({
      userMessage,
      merged,
      nextField: finalMeta.field,
      fallbackQuestion: finalMeta.question,
    });
    if (contextualQuestion) assistantQuestion = contextualQuestion;
  }

  const newAsked = [...flow.asked_questions, { field: finalMeta.field, question: assistantQuestion }];

  return {
    stage: 'clarification',
    assistant_message: assistantQuestion,
    extracted_data: merged,
    diagnosis: null,
    missing_fields: missing,
    flowState: {
      asked_questions: newAsked,
      stage: 'clarification',
      intent: merged.intent,
      service_type: merged.service_type,
      decision_path: {
        mode: useLlmFirstFlow ? 'llm_first' : 'hybrid',
        next_field: finalMeta.field,
        used_llm_dialog: Boolean(llmMeta),
        budget_remaining_ms: remainingBudgetMs(),
      },
    },
  };
}

export { BOOTSTRAP_ASSISTANT_MESSAGE } from '../config/consultationFlow.config.js';
