/**
 * Извлечение полей консультации: правила + опциональный LLM.
 * Реализация в extract/*; этот модуль — публичный фасад.
 */

export { tryExtractUniversalConditionAnswer, preExtractFromRules } from './extract/rules.js';
export {
  postProcessMerged,
  countFieldsChangedByPre,
  isSimpleExtractionMessage,
  shouldSkipLlmExtraction,
  preferPreExtractedServiceSymptoms,
} from './extract/policy.js';
export { extractConsultationData } from './extract/llm.js';
