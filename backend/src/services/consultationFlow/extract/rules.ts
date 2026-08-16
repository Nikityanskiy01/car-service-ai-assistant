import { mergeObdCodesString, parseObdCodes } from '../../../lib/obdCodes.js';
import { detectConsultationIntent } from '../../consultationIntent.service.js';
import { isValidModelText } from '../questions.js';
import {
  EMPTY_CONSULTATION_STATE,
  mergeExtractedData,
  normalizeConditions,
  normalizeSymptoms,
} from '../state.js';
import { CONDITION_HINTS, SYMPTOM_HINTS } from './hints.js';
import { extractMileageRegex, extractYearRegex } from './regex.js';

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

/**
 * Ответы вроде «всегда» на вопрос про условия — rule-based, т.к. LLM часто даёт conditions: null.
 * @param message
 * @param base merged state (должны быть симптомы диагностики)
 * @returns
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
 * @param message
 * @param base
 */
export function preExtractFromRules(message, base: any = {}) {
  const out = mergeExtractedData(EMPTY_CONSULTATION_STATE, base);
  const t = String(message || '').trim();
  if (!t) return out;
  const low = t.toLowerCase();

  const y = extractYearRegex(t);
  if (y) out.year = y;

  const mileage = extractMileageRegex(t, base);
  if (mileage != null) out.mileage = mileage;

  if (!out.car_make || !out.car_model) {
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
