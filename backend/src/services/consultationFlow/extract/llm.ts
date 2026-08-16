import {
  EXTRACTION_FORMAT_SCHEMA,
  EXTRACTION_SYSTEM_PROMPT,
  extractionUserPrompt,
} from '../../../prompts/consultationPrompts.js';
import { getEnv } from '../../../config/env.js';
import { chatCompletion } from '../../ollamaService.js';
import { EMPTY_CONSULTATION_STATE, mergeExtractedData } from '../state.js';
import {
  normalizeExtractedFromLlm,
  postProcessMerged,
  preferPreExtractedServiceSymptoms,
  shouldSkipLlmExtraction,
} from './policy.js';
import { preExtractFromRules } from './rules.js';

/**
 * @param message
 * @param currentState
 */
export async function extractConsultationData(message, currentState: any = {}) {
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
