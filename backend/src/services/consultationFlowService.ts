/**
 * Гибридный consultation flow: state machine + правила сценария.
 * LLM используется только для извлечения полей и диагностики — не для выбора следующего вопроса.
 *
 * Реализация в consultationFlow/*; этот модуль — оркестратор и публичный фасад.
 */

import { detectConsultationIntent, detectServiceType } from './consultationIntent.service.js';
import { shouldUseAsyncDiagnosis } from './diagnosisJob.service.js';
import { extractConsultationData, postProcessMerged } from './consultationFlow/extract.js';
import { deriveConsultationStage } from './consultationFlow/progress.js';
import { getNextQuestion, resolveQuestionAvoidingRepeat } from './consultationFlow/questions.js';
import { getMissingFields, isFieldFilled, mergeExtractedData } from './consultationFlow/state.js';

export {
  EMPTY_CONSULTATION_STATE,
  mergeExtractedData,
  isFieldFilled,
  getMissingFields,
  normalizeConditions,
  normalizeSymptoms,
  detectSymptomCategory,
} from './consultationFlow/state.js';
export {
  getNextQuestion,
  shouldAskQuestion,
  getCategoryConditionsQuestion,
  generateCategoryFollowupQuestion,
  getLastAssistantContent,
  isValidVehicleText,
  isValidModelText,
} from './consultationFlow/questions.js';
export {
  tryExtractUniversalConditionAnswer,
  preExtractFromRules,
  countFieldsChangedByPre,
  isSimpleExtractionMessage,
  shouldSkipLlmExtraction,
  preferPreExtractedServiceSymptoms,
  extractConsultationData,
} from './consultationFlow/extract.js';
export {
  progressFromConsultationSteps,
  progressFromStage,
  deriveConsultationStage,
  progressFromMandatoryFields,
  progressFromServiceFields,
} from './consultationFlow/progress.js';

export { BOOTSTRAP_ASSISTANT_MESSAGE } from '../config/consultationFlow.config.js';

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

const MAX_ASKS_PER_FIELD = 3;

/**
 * @param session
 * @param userMessage
 * @param onProgress
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
    obd_codes: session?.extracted?.obdCodes ?? null,
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
    onProgress?.({ phase: 'analyzing_symptoms' });
    onProgress?.({ phase: 'diagnosing' });
    const { generateDiagnosis } = await import('../modules/consultations/consultationAi.service.js');
    const flowPhoto =
      session?.flowState &&
      typeof session.flowState === 'object' &&
      !Array.isArray(session.flowState) &&
      session.flowState.photo_observations &&
      typeof session.flowState.photo_observations === 'object'
        ? session.flowState.photo_observations
        : null;
    const photoObservations = Array.isArray(flowPhoto?.observations)
      ? flowPhoto.observations.map((x) => String(x)).filter(Boolean).slice(0, 8)
      : [];

    if (shouldUseAsyncDiagnosis()) {
      const diagnosisPayload = {
        car_make: merged.car_make ?? null,
        car_model: merged.car_model ?? null,
        year: merged.year ?? null,
        mileage: merged.mileage ?? null,
        symptoms: merged.symptoms ?? null,
        conditions: merged.conditions ?? null,
        urgency_signs: merged.urgency_signs ?? null,
        obd_codes: merged.obd_codes ?? null,
        category: merged.category ?? null,
        intent: merged.intent ?? null,
        service_type: merged.service_type ?? null,
        photo_observations: photoObservations,
      };
      const isService = merged.intent === 'service';
      const st = isService ? detectServiceType(String(merged.symptoms || '')) : null;
      return {
        stage: 'DIAGNOSIS_QUEUED',
        assistant_message:
          'Спасибо, все ключевые данные получены. Запускаем интеллектуальный анализ — результат появится через несколько секунд.',
        extracted_data: merged,
        diagnosis: null,
        diagnosis_payload: diagnosisPayload,
        missing_fields: [],
        service_type: st || merged.service_type || null,
        flowState: {
          asked_questions: flow.asked_questions,
          stage: 'DIAGNOSIS_QUEUED',
          intent: merged.intent || 'diagnostic',
          service_type: st || merged.service_type || null,
        },
      };
    }

    const diagnosis: any = await generateDiagnosis({ ...merged, photo_observations: photoObservations });
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
