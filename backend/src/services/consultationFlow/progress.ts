import { detectConsultationIntent } from '../consultationIntent.service.js';
import { isFieldFilled } from './state.js';

export function progressFromStage(stage) {
  const map = {
    INITIAL: 0,
    COLLECTING_VEHICLE: 20,
    COLLECTING_SYMPTOMS: 45,
    CLARIFYING: 65,
    READY_FOR_ANALYSIS: 80,
    ANALYZING: 90,
    DIAGNOSIS_QUEUED: 85,
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

/**
 * Прогресс по шагам: марка, модель, пробег, запрос; для diagnostic — ещё условия.
 * @param data
 */
export function progressFromConsultationSteps(data) {
  const stage = deriveConsultationStage(data, []);
  return progressFromStage(stage);
}

/** @deprecated Используйте progressFromConsultationSteps */
export function progressFromMandatoryFields(data) {
  return progressFromConsultationSteps(data);
}

/** @deprecated Используйте progressFromConsultationSteps */
export function progressFromServiceFields(data) {
  return progressFromConsultationSteps(data);
}
