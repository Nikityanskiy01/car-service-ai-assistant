import {
  DIAGNOSIS_FORMAT_SCHEMA,
  DIAGNOSIS_SYSTEM_PROMPT,
  diagnosisUserPrompt,
} from '../../../prompts/consultationPrompts.js';
import { getEnv } from '../../../config/env.js';
import { getRelevantCases } from '../../../services/caseMemory.service.js';
import { getConfirmedFewShotExamples } from '../../../services/consultationFeedback.service.js';
import { runDiagnosisQueued } from '../../../services/diagnosisQueue.service.js';
import { recordDiagnosisCacheHit, recordLlmValidationFailure } from '../../../services/llmMetrics.service.js';
import {
  buildDiagnosisCacheKey,
  getDiagnosisCache,
  setDiagnosisCache,
} from '../../../lib/diagnosisCache.js';
import { isFieldFilled } from '../../../services/consultationFlowService.js';
import { chatCompletionWithMeta } from '../../../services/ollamaService.js';
import { enrichRuleBasedWithPlaybook, pickPlaybook, playbookToAiHints } from '../../../lib/diagnosticPlaybooks.js';
import { formatObdForPrompt } from '../../../lib/obdCodeCatalog.js';
import { parseObdCodes } from '../../../lib/obdCodes.js';
import { estimateCostFromMinor } from '../../../lib/pricing.js';
import { topWorksForCategory, topWorksForCategoryAndMake } from '../../../lib/workStats.js';
import { detectConsultationIntent } from '../../../services/consultationIntent.service.js';
import { safeJsonParse } from '../../../utils/safeJsonParse.js';
import { logger } from '../../../lib/logger.js';
import { mergeDiagnosis, normalizeDiagnosis, normalizeDiagnosisResult } from './merge.js';
import { preAnalyzeSymptoms } from './preAnalyze.js';
import { buildPlaybookFallbackDiagnosis, validateDiagnosisQuality } from './quality.js';

function cacheDiagnosisIfSuccessful(cacheKey, result) {
  if (result?.analysis_available !== false && result?.status !== 'MANUAL_REVIEW_REQUIRED') {
    setDiagnosisCache(cacheKey, result);
  }
  return result;
}

export async function generateDiagnosis(data) {
  return runDiagnosisQueued(() => generateDiagnosisCore(data));
}

export async function generateDiagnosisCore(data) {
  const cond = data?.conditions ?? data?.problemConditions;
  const payload = {
    car_make: data.car_make ?? null,
    car_model: data.car_model ?? null,
    year: data.year ?? null,
    mileage: data.mileage ?? null,
    symptoms: data.symptoms ?? null,
    conditions: cond ?? null,
    urgency_signs: data.urgency_signs ?? null,
    obd_codes: data.obd_codes ?? null,
    category: data.category ?? null,
  };
  const obdCodes = parseObdCodes(`${payload.obd_codes || ''} ${payload.symptoms || ''}`);
  const obdInterpretations = formatObdForPrompt(obdCodes);
  const photoObservations = Array.isArray(data.photo_observations)
    ? data.photo_observations.map((x) => String(x)).filter(Boolean).slice(0, 8)
    : [];

  const ruleBasedRaw = preAnalyzeSymptoms(payload);
  const pb = pickPlaybook(payload, String(data.symptoms || ''));
  const ruleBased = enrichRuleBasedWithPlaybook(ruleBasedRaw, pb, `${payload.symptoms || ''} ${cond || ''}`);
  const hasCriticalSafety = String(ruleBased?.urgency || '').toLowerCase() === 'critical';
  const isService =
    data.intent === 'service' || detectConsultationIntent(String(data.symptoms || '')) === 'service';
  if (!isFieldFilled('symptoms', data.symptoms) || (!isService && !isFieldFilled('conditions', cond) && !hasCriticalSafety)) {
    return buildPlaybookFallbackDiagnosis({ reason: 'INSUFFICIENT_DATA', ruleBased, playbook: pb, payload });
  }

  const cacheKey = buildDiagnosisCacheKey(payload);
  const cached = getDiagnosisCache(cacheKey);
  if (cached) {
    recordDiagnosisCacheHit();
    return cached;
  }

  const pbHints = playbookToAiHints(pb);
  const tw =
    pbHints?.categoryId && payload.car_make
      ? topWorksForCategoryAndMake(pbHints.categoryId, payload.car_make, 10)
      : pbHints?.categoryId
        ? topWorksForCategory(pbHints.categoryId, 10)
        : [];

  const [relatedCasesResult, confirmedExamplesResult] = await Promise.allSettled([
    getRelevantCases(payload),
    getConfirmedFewShotExamples(),
  ]);
  const relatedCases: any[] = relatedCasesResult.status === 'fulfilled' ? (relatedCasesResult.value as any[]) : [];
  const confirmedExamples: any[] =
    confirmedExamplesResult.status === 'fulfilled' ? (confirmedExamplesResult.value as any[]) : [];
  const env = getEnv();
  const diagnosisModel = env.LLM_DIAGNOSIS_MODEL?.trim() || env.LLM_MODEL;
  const callDiagnosisLlm = async (extraInstructions = '') =>
    chatCompletionWithMeta({
      model: diagnosisModel,
      temperature: 0.15,
      timeoutMs: env.LLM_DIAGNOSIS_TIMEOUT_MS,
      keepAlive: env.LLM_KEEP_ALIVE,
      format: DIAGNOSIS_FORMAT_SCHEMA,
      options: {
        num_predict: env.LLM_DIAGNOSIS_NUM_PREDICT,
        num_ctx: 3072,
      },
      messages: [
        { role: 'system', content: DIAGNOSIS_SYSTEM_PROMPT },
        {
          role: 'user',
          content:
            diagnosisUserPrompt(
              payload,
              relatedCases,
              pbHints,
              tw,
              obdInterpretations,
              photoObservations,
              confirmedExamples,
            ) +
            (extraInstructions ? `\n\nТребуется исправить JSON по замечаниям:\n${extraInstructions}` : ''),
        },
      ],
    });
  const structuredFallback = (reason, executionMeta) =>
    buildPlaybookFallbackDiagnosis({
      reason,
      executionMeta,
      ruleBased,
      playbook: pb,
      payload,
      estimatedCost: estimateCostFromMinor(payload, {
        recommendations: (ruleBased.probable_causes || []).map((title) => ({ title })),
      }),
    });
  try {
    const startedAt = new Date().toISOString();
    const first = await callDiagnosisLlm();
    const executionMeta = {
      provider: first.provider === 'openai' ? 'vsellm' : first.provider,
      model: first.model || diagnosisModel || null,
      requestId: `diag-${Date.now()}`,
      startedAt,
      completedAt: new Date().toISOString(),
      durationMs: Number.isFinite(first.durationMs) ? first.durationMs : null,
      attemptCount: Number.isFinite(first.attemptCount) ? first.attemptCount : 1,
      streamed: Boolean(first.streamed),
      status: first.status === 'FALLBACK' ? 'FALLBACK' : 'SUCCESS',
      errorCode: null,
    };
    logger.info(
      {
        event: 'vsellm_response_received',
        provider: executionMeta.provider,
        model: executionMeta.model,
        durationMs: executionMeta.durationMs,
        attempts: executionMeta.attemptCount,
      },
      'diagnosis llm response received',
    );
    let parsed = safeJsonParse(first.content);
    if (!parsed) {
      const repaired = await callDiagnosisLlm('Ответ должен быть строго валидным JSON по целевой схеме.');
      parsed = safeJsonParse(repaired.content);
    }
    if (!parsed) throw new Error('diagnosis: invalid json from llm');
    const llmDiagnosis = normalizeDiagnosis(parsed);
    const merged = mergeDiagnosis(ruleBased, llmDiagnosis);
    const quality = validateDiagnosisQuality(merged);
    if (!quality.valid) {
      recordLlmValidationFailure();
      logger.warn(
        { event: 'vsellm_validation_failed', issues: quality.issues, model: executionMeta.model },
        'diagnosis quality validation failed',
      );
      const repaired = await callDiagnosisLlm(`Нарушения: ${quality.issues.join(', ')}`);
      const repairedParsed = safeJsonParse(repaired.content);
      if (repairedParsed) {
        const repairedMerged = mergeDiagnosis(ruleBased, normalizeDiagnosis(repairedParsed));
        const repairedQuality = validateDiagnosisQuality(repairedMerged);
        if (repairedQuality.valid) {
          return cacheDiagnosisIfSuccessful(
            cacheKey,
            normalizeDiagnosisResult({ ...repairedMerged, execution_meta: executionMeta }),
          );
        }
      }
      return cacheDiagnosisIfSuccessful(cacheKey, structuredFallback('LLM_VALIDATION_FAILED', executionMeta));
    }
    return cacheDiagnosisIfSuccessful(cacheKey, normalizeDiagnosisResult({ ...merged, execution_meta: executionMeta }));
  } catch (err) {
    logger.warn(
      {
        event: 'fallback_activated',
        code: 'LLM_UNAVAILABLE',
        err: err instanceof Error ? err.message : String(err || ''),
      },
      'diagnosis switched to playbook fallback',
    );
    return cacheDiagnosisIfSuccessful(
      cacheKey,
      structuredFallback('LLM_UNAVAILABLE', {
        provider: 'fallback',
        model: diagnosisModel || null,
        requestId: `diag-${Date.now()}`,
        startedAt: new Date().toISOString(),
        completedAt: null,
        durationMs: null,
        attemptCount: 1,
        streamed: false,
        status: 'FAILED',
        errorCode: 'LLM_UNAVAILABLE',
      }),
    );
  }
}
