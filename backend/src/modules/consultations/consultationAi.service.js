/**
 * Гибридная диагностика: rule-based пре-анализ + LLM JSON + merge.
 * Реализация в consultationAi/*; этот модуль — публичный фасад.
 */

export { coerceDiagnosisLine } from './consultationAi/coerce.js';
export { preAnalyzeSymptoms } from './consultationAi/preAnalyze.js';
export {
  buildRuleBasedSummary,
  isWeakSummary,
  normalizeDiagnosisResult,
  mergeDiagnosis,
} from './consultationAi/merge.js';
export { generateDiagnosis, generateDiagnosisCore } from './consultationAi/generate.js';

export {
  buildConsultationState,
  extractConsultationData,
  progressFromConsultationSteps,
} from '../../services/consultationFlowService.js';
export { detectConsultationIntent, detectServiceType } from '../../services/consultationIntent.service.js';
