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
  EXTRACTION_FORMAT_SCHEMA,
  EXTRACTION_SYSTEM_PROMPT,
  extractionUserPrompt,
} from '../prompts/consultationPrompts.js';
import {
  detectConsultationIntent,
  detectServiceType,
} from './consultationIntent.service.js';
import { getEnv } from '../config/env.js';
import { chatCompletion } from './ollamaService.js';

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
 * Недостающие поля: марка → модель → описание запроса → условия (только diagnostic).
 * Пробег — желательное поле, но не всегда блокирует анализ.
 * @param {Record<string, unknown>} data
 */
export function getMissingFields(data) {
  const base = ['car_make', 'car_model', 'symptoms'];
  const missing = base.filter((k) => !isFieldFilled(k, data[k]));
  if (missing.length) return missing;
  const symptomsText = String(data.symptoms || '');
  if (detectConsultationIntent(symptomsText) === 'service') {
    return [];
  }
  if (isCriticalSafetySymptom(symptomsText)) {
    return [];
  }
  const category = detectSymptomCategory(symptomsText);
  if (category === 'engine' && !isFieldFilled('mileage', data.mileage)) {
    return ['mileage'];
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
  s = s.replace(/не\s+заводит(?:ся)?/gi, 'не запускается');
  s = s.replace(/\bтроит\b/gi, 'двигатель троит');
  s = s.replace(/\bглохнет\b/gi, 'двигатель глохнет');
  s = s.replace(/плавают\s+обороты/gi, 'плавают обороты');
  s = s.replace(/нестабильн\w*\s+оборот\w*/gi, 'плавают обороты');
  s = s.replace(/биение\s+руля/gi, 'биение руля');
  if (/^стук$/i.test(s)) s = 'посторонний стук';
  return s;
}

function isCriticalSafetySymptom(symptoms) {
  const text = String(symptoms || '').toLowerCase();
  return (
    (text.includes('педаль тормоза') && (text.includes('провал') || text.includes('тормозит хуже'))) ||
    text.includes('пар из-под капота') ||
    text.includes('дым из-под капота') ||
    text.includes('утечка топлива') ||
    (text.includes('запах') && text.includes('бензин')) ||
    (text.includes('давлен') && text.includes('масл') && text.includes('красн'))
  );
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
 * Порядок уточнений: марка → модель → симптом → пробег (опционально) → условия.
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
  if (!isFieldFilled('symptoms', data.symptoms)) {
    return { field: 'symptoms', question: FLOW_QUESTIONS.symptoms };
  }
  if (!isFieldFilled('mileage', data.mileage)) {
    return { field: 'mileage', question: FLOW_QUESTIONS.mileage };
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

function extractMileageRegex(t, base = {}) {
  const low = t.toLowerCase();
  const normalized = low.replace(/\s+/g, ' ').trim();
  const explicitUnknown = /(не\s+знаю|неизвест|без\s+пробега|пробег\s+не\s+указан)/i.test(normalized);
  if (explicitUnknown) return null;

  const hasMileageContext = /пробег|одометр|на\s+одометре|тыс/.test(normalized);
  const hasVehicleContext =
    Boolean(base?.car_make) ||
    Boolean(base?.car_model) ||
    /\b(skoda|toyota|kia|bmw|audi|vw|volkswagen|honda|hyundai|nissan|ford|лада|шкода|тойота)\b/i.test(t);

  const explicitMileageMatch =
    t.match(/(?:пробег|одометр|на\s+одометре)\D{0,20}(\d[\d\s]{1,7})\s*(тыс(?:\.|яч(?:а|и)?)?)?/i) ||
    t.match(/\b(\d{2,3})\s*тыс(?:\.|яч(?:а|и)?)\s*(?:км)?\b/i);
  if (explicitMileageMatch) {
    const raw = String(explicitMileageMatch[1]).replace(/\s+/g, '');
    const n = Number(raw);
    if (!Number.isFinite(n)) return null;
    const isThousands =
      /тыс/i.test(String(explicitMileageMatch[0])) || (/пробег/i.test(low) && n > 0 && n < 1000);
    return isThousands ? n * 1000 : n;
  }

  const kmMatch = t.match(/\b(\d{3,7})\s*км\b(?!\s*\/\s*ч)/i);
  if (!kmMatch) {
    const plainNumber = String(t || '').trim();
    if (/^\d{3,7}$/.test(plainNumber) && hasVehicleContext) {
      const n = Number(plainNumber);
      if (Number.isFinite(n) && (n < 1950 || n > 2035)) return n;
    }
    return null;
  }

  const n = Number(String(kmMatch[1]).replace(/\s+/g, ''));
  if (!Number.isFinite(n)) return null;
  if (!hasMileageContext && (n >= 1950 && n <= 2035)) return null;
  if (!hasMileageContext && !hasVehicleContext) {
    if (/после\s+ремонта|после\s+замены|проехал|поездк|маршрут/i.test(normalized)) return null;
  }
  return n;
}

function extractYearRegex(t) {
  const matches = [...String(t || '').matchAll(/\b(19[7-9]\d|20[0-3]\d)\b/g)];
  for (const m of matches) {
    const year = Number(m[1]);
    const idx = m.index ?? -1;
    const left = String(t).slice(Math.max(0, idx - 20), idx).toLowerCase();
    const right = String(t).slice(idx + String(m[0]).length, idx + String(m[0]).length + 16).toLowerCase();
    const mileageContext = /пробег|одометр/.test(left) || /\s*км\b/.test(right);
    if (mileageContext) continue;
    return year;
  }
  return null;
}

const CONDITION_HINTS =
  /при\s+(движении|запуске|торможении|разгоне|повороте)|на\s+(холодную|горячую|ходу|кочках|скорости)|на\s+холост|после\s+прогрева|в\s+пробке|выключен\w*\s+(мотор|двигател)\w*|на\s+выключенном|мотор\s+выключен|двигател\w*\s+выключен|engine\s+off|заглушен\w*\s+(мотор|двигател)\w*/i;

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
  if (y) out.year = y;

  const mileage = extractMileageRegex(t, base);
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
      const m = t.match(rx);
      if (m) {
        if (!out.car_make) out.car_make = make;
        if (!out.car_model) {
          const rest = String(m[1] || '')
            .trim()
            .split(/\s+/)[0];
          if (rest && isValidModelText(rest)) out.car_model = rest;
        }
        break;
      }
    }
  }

  // Ответ на «уточните модель»: одно слово при уже известной марке
  if (out.car_make && !out.car_model && t.length <= 28 && !/\d{4,}/.test(t)) {
    const token = t.split(/\s+/)[0];
    if (token && isValidModelText(token) && !/^(тыс|км|пробег)$/i.test(token)) {
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
 * Пропускаем вызов Ollama, если правила уже разобрали сообщение.
 * @param {string} message
 * @param {Record<string, unknown>} base
 * @param {Record<string, unknown>} pre
 */
export function shouldSkipLlmExtraction(message, base, pre) {
  const msg = String(message || '').trim();
  if (!msg) return true;
  if (isSimpleExtractionMessage(msg)) return true;

  const delta = countFieldsChangedByPre(base, pre);
  if (delta >= 2) return true;
  if (delta > 0 && msg.length <= 140) return true;

  return false;
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
  const env = getEnv();

  if (!env.LLM_FORCE_EXTRACTION && shouldSkipLlmExtraction(msg, base, pre)) {
    return postProcessMerged(pre);
  }

  const extractionModel = env.LLM_EXTRACTION_MODEL?.trim() || env.LLM_MODEL;

  try {
    const raw = await chatCompletion({
      model: extractionModel,
      temperature: 0,
      timeoutMs: 45_000,
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

function parseFlowState(raw) {
  if (raw == null) return null;
  if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
    const asked = Array.isArray(raw.asked_questions) ? raw.asked_questions : [];
    let stage = 'CLARIFYING';
    if (raw.stage === 'result' || raw.stage === 'service_result' || raw.stage === 'COMPLETED') stage = 'COMPLETED';
    else if (raw.stage === 'MANUAL_REVIEW_REQUIRED') stage = 'MANUAL_REVIEW_REQUIRED';
    else if (typeof raw.stage === 'string' && raw.stage) stage = raw.stage;
    return {
      asked_questions: asked
        .filter((x) => x && typeof x === 'object')
        .map((x) => ({ field: String(x.field || ''), question: String(x.question || '') })),
      stage,
      intent: raw.intent === 'service' || raw.intent === 'diagnostic' ? raw.intent : null,
      service_type: typeof raw.service_type === 'string' && raw.service_type ? raw.service_type : null,
    };
  }
  return { asked_questions: [], stage: 'CLARIFYING', intent: null, service_type: null };
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

const MAX_ASKS_PER_FIELD = 3;

/**
 * Прогресс по шагам: марка, модель, пробег, запрос; для diagnostic — ещё условия.
 * @param {Record<string, unknown>} data
 */
export function progressFromConsultationSteps(data) {
  const stage = deriveConsultationStage(data, []);
  return progressFromStage(stage);
}

export function progressFromStage(stage) {
  const map = {
    INITIAL: 0,
    COLLECTING_VEHICLE: 20,
    COLLECTING_SYMPTOMS: 45,
    CLARIFYING: 65,
    READY_FOR_ANALYSIS: 80,
    ANALYZING: 90,
    COMPLETED: 100,
    MANUAL_REVIEW_REQUIRED: 100,
    FAILED: 100,
  };
  return map[String(stage)] ?? 0;
}

export function deriveConsultationStage(data, missingFields = []) {
  if (missingFields.includes('car_make') || missingFields.includes('car_model')) return 'COLLECTING_VEHICLE';
  if (missingFields.includes('symptoms')) return 'COLLECTING_SYMPTOMS';
  if (missingFields.includes('conditions') || missingFields.includes('mileage')) return 'CLARIFYING';
  if (!isFieldFilled('symptoms', data?.symptoms)) return 'COLLECTING_SYMPTOMS';
  if (!isFieldFilled('conditions', data?.conditions) && detectConsultationIntent(String(data?.symptoms || '')) !== 'service') {
    return 'CLARIFYING';
  }
  return 'READY_FOR_ANALYSIS';
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
  const flow =
    parseFlowState(session?.flowState) || {
      asked_questions: [],
      stage: 'CLARIFYING',
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
  const extractedNew = await extractConsultationData(userMessage, existing);
  let merged = mergeExtractedData(existing, extractedNew);
  merged = postProcessMerged(merged);
  onProgress?.({ phase: 'extracted', data: merged });

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

  if (flow.stage === 'COMPLETED') {
    return {
      stage: 'COMPLETED',
      assistant_message: 'Консультация завершена. Нажмите «Новая сессия» для нового запроса.',
      extracted_data: merged,
      diagnosis: null,
      missing_fields: [],
      flowState: flow,
    };
  }

  let missing = getMissingFields(merged);

  const fieldAskCount = (field) =>
    flow.asked_questions.filter((q) => q.field === field).length;
  const exhausted = missing.filter((f) => fieldAskCount(f) >= MAX_ASKS_PER_FIELD);
  if (exhausted.length) {
    missing = missing.filter((f) => !exhausted.includes(f));
  }

  if (missing.length === 0) {
    onProgress?.({ phase: 'diagnosing' });
    const { generateDiagnosis } = await import('../modules/consultations/consultationAi.service.js');
    const diagnosis = await generateDiagnosis(merged);
    const isManual = String(diagnosis?.status || '').toUpperCase() === 'MANUAL_REVIEW_REQUIRED';

    const isService = merged.intent === 'service';
    const st = isService ? detectServiceType(String(merged.symptoms || '')) : null;

    return {
      stage: isManual ? 'MANUAL_REVIEW_REQUIRED' : 'COMPLETED',
      assistant_message: isManual
        ? diagnosis.summary
        : diagnosis.summary + '\n\nВы можете сохранить отчёт и оформить заявку в сервис.',
      extracted_data: merged,
      diagnosis,
      missing_fields: [],
      service_type: st || merged.service_type || null,
      flowState: {
        asked_questions: flow.asked_questions,
        stage: isManual ? 'MANUAL_REVIEW_REQUIRED' : 'COMPLETED',
        intent: merged.intent || 'diagnostic',
        service_type: st || merged.service_type || null,
      },
    };
  }

  const meta = getNextQuestion({ ...merged, ...Object.fromEntries(exhausted.map((f) => [f, '__skip__'])) });
  if (!meta) {
    throw new Error('consultationFlow: getNextQuestion returned null while mandatory fields are missing');
  }

  const resolved = resolveQuestionAvoidingRepeat(meta, session, flow.asked_questions, merged);
  const finalMeta = resolved || meta;
  const newAsked = [...flow.asked_questions, { field: finalMeta.field, question: finalMeta.question }];

  return {
    stage: deriveConsultationStage(merged, missing),
    assistant_message: finalMeta.question,
    extracted_data: merged,
    diagnosis: null,
    missing_fields: missing,
    flowState: {
      asked_questions: newAsked,
      stage: deriveConsultationStage(merged, missing),
      intent: merged.intent,
      service_type: merged.service_type,
    },
  };
}

export { BOOTSTRAP_ASSISTANT_MESSAGE } from '../config/consultationFlow.config.js';
