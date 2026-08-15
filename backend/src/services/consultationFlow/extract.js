import {
  EXTRACTION_FORMAT_SCHEMA,
  EXTRACTION_SYSTEM_PROMPT,
  extractionUserPrompt,
} from '../../prompts/consultationPrompts.js';
import { getEnv } from '../../config/env.js';
import { mergeObdCodesString, parseObdCodes } from '../../lib/obdCodes.js';
import { detectConsultationIntent } from '../consultationIntent.service.js';
import { chatCompletion } from '../ollamaService.js';
import { isValidModelText, isValidVehicleText } from './questions.js';
import {
  EMPTY_CONSULTATION_STATE,
  detectSymptomCategory,
  isFieldFilled,
  mergeExtractedData,
  normalizeConditions,
  normalizeSymptoms,
} from './state.js';

const EXTRACTION_FIELD_KEYS = [
  'car_make',
  'car_model',
  'year',
  'mileage',
  'symptoms',
  'conditions',
  'urgency_signs',
];

const CONDITION_HINTS =
  /при\s+(движении|запуске|торможении|разгоне|повороте)|на\s+(холодную|горячую|ходу|кочках|скорости)|на\s+холост|после\s+прогрева|в\s+пробке|выключен\w*\s+(мотор|двигател)\w*|на\s+выключенном|мотор\s+выключен|двигател\w*\s+выключен|engine\s+off|заглушен\w*\s+(мотор|двигател)\w*/i;

const SYMPTOM_HINTS =
  /пропуск|троит|оборот|стук|скрип|вибрац|тормож|рывк|дым|перегрев|запуск|глох|биение|плава|чек|короб|рул|подвеск|старт/i;

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
    obd_codes: mergeObdCodesString(null, obj.obd_codes != null ? String(obj.obd_codes) : null),
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

  const obd = mergeObdCodesString(out.obd_codes, parseObdCodes(t).join(', '));
  if (obd) out.obd_codes = obd;

  return out;
}

export function postProcessMerged(merged) {
  const out = { ...merged };
  if (out.symptoms) out.symptoms = normalizeSymptoms(String(out.symptoms));
  if (out.conditions) out.conditions = normalizeConditions(String(out.conditions));
  if (out.symptoms) out.category = detectSymptomCategory(String(out.symptoms));
  return out;
}

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
