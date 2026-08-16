import { mergeObdCodesString } from '../../../lib/obdCodes.js';
import { detectConsultationIntent } from '../../consultationIntent.service.js';
import { isValidModelText, isValidVehicleText } from '../questions.js';
import { detectSymptomCategory, isFieldFilled, normalizeConditions, normalizeSymptoms } from '../state.js';
import { CONDITION_HINTS, EXTRACTION_FIELD_KEYS, SYMPTOM_HINTS } from './hints.js';

export function normalizeExtractedFromLlm(raw) {
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

export function postProcessMerged(merged) {
  const out = { ...merged };
  if (out.symptoms) out.symptoms = normalizeSymptoms(String(out.symptoms));
  if (out.conditions) out.conditions = normalizeConditions(String(out.conditions));
  if (out.symptoms) out.category = detectSymptomCategory(String(out.symptoms));
  return out;
}

/**
 * Сколько полей rule-based слой добавил или уточнил относительно base.
 * @param base
 * @param pre
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
 * @param message
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
 * @param message
 * @param base
 * @param pre
 */
export function shouldSkipLlmExtraction(message, base, pre) {
  const msg = String(message || '').trim();
  if (!msg) return true;
  if (isSimpleExtractionMessage(msg)) return true;

  const symptomsFilled = isFieldFilled('symptoms', pre.symptoms) || isFieldFilled('symptoms', base.symptoms);
  if (!symptomsFilled && (msg.length > 80 || SYMPTOM_HINTS.test(msg))) return false;

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
