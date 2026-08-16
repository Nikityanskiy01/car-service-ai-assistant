import {
  ALT_FLOW_QUESTIONS,
  CATEGORY_CONDITIONS_QUESTIONS,
  FLOW_QUESTIONS,
} from '../../config/consultationFlow.config.js';
import { detectConsultationIntent } from '../consultationIntent.service.js';
import { EMPTY_CONSULTATION_STATE, isFieldFilled } from './state.js';

/**
 * Порядок уточнений: марка → модель → симптом → пробег (опционально) → условия.
 * @param state
 * @returns
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
 * @param messages
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
 * @param {{ messages?: Array<{ sender?: string, content?: string }> }} session
 * @param questionMeta
 * @param askedQuestions
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
 * @param category
 */
export function getCategoryConditionsQuestion(category) {
  return CATEGORY_CONDITIONS_QUESTIONS[category] || CATEGORY_CONDITIONS_QUESTIONS.unknown;
}

/** Совместимость со старым symptomClassifier */
export function generateCategoryFollowupQuestion(category) {
  return getCategoryConditionsQuestion(category);
}

/**
 * Отсекает мусор в марке после LLM.
 * @param value
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
 * @param value
 */
export function isValidModelText(value) {
  if (!value || typeof value !== 'string') return false;
  const v = value.trim();
  if (!v.length || v.length > 25) return false;
  if (/[^a-zA-Zа-яА-Я0-9\-\s]/.test(v)) return false;
  if (/^[0-9]+$/.test(v)) return v.length <= 4;
  return isValidVehicleText(value);
}

function pickAlternateQuestion(meta) {
  if (meta.field === 'conditions') {
    return { field: meta.field, question: ALT_FLOW_QUESTIONS.conditions };
  }
  return { field: meta.field, question: ALT_FLOW_QUESTIONS[meta.field] || meta.question };
}

export function resolveQuestionAvoidingRepeat(meta, session, askedQuestions, _mergedState) {
  if (!meta) return null;
  if (shouldAskQuestion(session, meta, askedQuestions)) return meta;
  const alt = pickAlternateQuestion(meta);
  if (shouldAskQuestion(session, alt, askedQuestions)) return alt;
  return alt;
}
