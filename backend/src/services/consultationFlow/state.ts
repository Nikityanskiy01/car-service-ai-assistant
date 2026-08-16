import {
  CATEGORY_RULES,
  ENGINE_EXTRA_KEYWORDS,
} from '../../config/consultationFlow.config.js';
import { detectConsultationIntent } from '../consultationIntent.service.js';

/** @typedef SymptomCategory */

export const EMPTY_CONSULTATION_STATE = {
  car_make: null,
  car_model: null,
  year: null,
  mileage: null,
  symptoms: null,
  conditions: null,
  urgency_signs: null,
  obd_codes: null,
  category: null,
  /** @type */
  intent: null,
  /** @type */
  service_type: null,
};

/**
 * @param currentData
 * @param newData
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
 * @param field
 * @param value
 */
export function isFieldFilled(field, value) {
  if (value === undefined || value === null) return false;
  if (field === 'year' || field === 'mileage') {
    const n = Number(value);
    return Number.isFinite(n) && n >= 0;
  }
  return String(value).trim().length > 0;
}

export function isCriticalSafetySymptom(symptoms) {
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
 * @param text
 */
export function normalizeConditions(text) {
  const src = String(text || '').trim();
  if (!src) return src;
  const low = src.toLowerCase();
  const map: Array<[RegExp, string]> = [
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
 * @param text
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

/**
 * @param symptoms
 * @returns
 */
export function detectSymptomCategory(symptoms) {
  const text = String(symptoms || '').toLowerCase();
  if (!text.trim()) return 'unknown';
  let best = { category: /** @type */ ('unknown'), score: 0 };
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
 * Недостающие поля: марка → модель → описание запроса → условия (только diagnostic).
 * Пробег — желательное поле, но не всегда блокирует анализ.
 * @param data
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
