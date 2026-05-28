import { z } from 'zod';
import { getEnv } from '../config/env.js';
import { chatCompletion } from './ollamaService.js';
import { safeJsonParse } from '../utils/safeJsonParse.js';
import {
  AGENT_CHECKS_FORMAT_SCHEMA,
  AGENT_CHECKS_SYSTEM_PROMPT,
  AGENT_CONTEXT_FORMAT_SCHEMA,
  AGENT_CONTEXT_SYSTEM_PROMPT,
  AGENT_FINAL_FORMAT_SCHEMA,
  AGENT_FINAL_SYSTEM_PROMPT,
  AGENT_HYPOTHESES_FORMAT_SCHEMA,
  AGENT_HYPOTHESES_SYSTEM_PROMPT,
  agentChecksUserPrompt,
  agentContextUserPrompt,
  agentFinalUserPrompt,
  agentHypothesesUserPrompt,
} from '../prompts/diagnosisAgentPrompts.js';

const contextSchema = z.object({
  normalized_symptoms: z.string().nullable(),
  normalized_conditions: z.string().nullable(),
  inferred_intent: z.enum(['diagnostic', 'service', 'unknown']),
  key_signals: z.array(z.string()).default([]),
  missing_data: z.array(z.string()).default([]),
});

const hypothesesSchema = z.object({
  probable_causes: z.array(z.string()).min(1).max(8),
  urgency: z.enum(['low', 'medium', 'high']),
  confidence: z.number().min(0).max(1),
  rationale: z.string().default(''),
});

const checksSchema = z.object({
  recommended_checks: z.array(z.string()).min(1).max(8),
  estimated_cost_from: z.number().int().nullable(),
  work_scope: z.array(z.string()).default([]),
});

const finalSchema = z.object({
  probable_causes: z.array(z.string()).min(1).max(8),
  recommended_checks: z.array(z.string()).min(1).max(8),
  urgency: z.enum(['low', 'medium', 'high']),
  confidence: z.number().min(0).max(1),
  estimated_cost_from: z.number().int().nullable(),
  summary: z.string().min(12),
});

function normalizeDiagnosisContract(data) {
  return {
    probable_causes: (data.probable_causes || []).map((x) => String(x).trim()).filter(Boolean).slice(0, 5),
    recommended_checks: (data.recommended_checks || [])
      .map((x) => String(x).trim())
      .filter(Boolean)
      .slice(0, 5),
    urgency: data.urgency,
    confidence: Math.max(0, Math.min(1, Number(data.confidence || 0))),
    estimated_cost_from:
      data.estimated_cost_from == null || !Number.isFinite(Number(data.estimated_cost_from))
        ? null
        : Math.max(0, Math.round(Number(data.estimated_cost_from))),
    summary: String(data.summary || '').trim(),
  };
}

function fallbackHypotheses(state) {
  const symptoms = String(state?.context?.normalized_symptoms || '').trim();
  const guessed = symptoms
    ? [`Проверка по симптомам: ${symptoms}`]
    : ['Требуется базовая первичная диагностика по обращению'];
  return {
    probable_causes: guessed,
    urgency: 'medium',
    confidence: 0.35,
    rationale: 'fallback_hypotheses',
  };
}

function fallbackChecks(state) {
  const checks = ['Компьютерная диагностика OBD-II', 'Осмотр на подъемнике'];
  if (state?.context?.normalized_symptoms) {
    checks.unshift(`Проверка жалобы: ${state.context.normalized_symptoms}`);
  }
  return {
    recommended_checks: checks.slice(0, 5),
    estimated_cost_from: 2500,
    work_scope: [],
  };
}

function fallbackFinal(state) {
  const probable = state?.hypotheses?.probable_causes?.length
    ? state.hypotheses.probable_causes
    : ['Требуется первичная диагностика'];
  const checks = state?.checks?.recommended_checks?.length
    ? state.checks.recommended_checks
    : ['Компьютерная диагностика OBD-II', 'Осмотр на подъемнике'];
  const urgency = state?.hypotheses?.urgency || 'medium';
  const confidence = Number.isFinite(Number(state?.hypotheses?.confidence))
    ? Math.max(0.2, Math.min(0.75, Number(state.hypotheses.confidence)))
    : 0.35;
  const estimated = state?.checks?.estimated_cost_from ?? 2500;
  const summary =
    'Собран предварительный вывод по обращению. Для подтверждения причин необходимо выполнить первичный набор проверок в сервисе.';
  return { probable_causes: probable, recommended_checks: checks, urgency, confidence, estimated_cost_from: estimated, summary };
}

async function runStep({
  stepName,
  systemPrompt,
  userPrompt,
  format,
  timeoutMs,
  retries,
  model,
  env,
  invokeCompletion,
  logger,
}) {
  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const started = Date.now();
    try {
      logger.info?.({
        event: 'agent_step_started',
        step: stepName,
        attempt: attempt + 1,
      });
      const raw = await invokeCompletion({
        model,
        temperature: 0.15,
        timeoutMs,
        keepAlive: env.LLM_KEEP_ALIVE,
        format,
        options: { num_ctx: 4096 },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      });
      const parsed = safeJsonParse(raw);
      if (!parsed) throw new Error('invalid_json');
      logger.info?.({
        event: 'agent_step_finished',
        step: stepName,
        attempt: attempt + 1,
        latency_ms: Date.now() - started,
      });
      return parsed;
    } catch (err) {
      lastError = err;
      logger.warn?.({
        event: 'agent_step_failed',
        step: stepName,
        attempt: attempt + 1,
        error: String(err?.message || err),
        latency_ms: Date.now() - started,
      });
    }
  }
  throw lastError || new Error(`${stepName}: failed`);
}

/**
 * LLMFactory-style multi-step diagnosis agent.
 * Returns diagnosis compatible with existing API contract.
 * @param {{
 *   payload: Record<string, unknown>,
 *   relatedCases?: Array<Record<string, unknown>>,
 *   playbook?: Record<string, unknown> | null,
 *   topWorks?: string[],
 *   env?: ReturnType<typeof getEnv>,
 *   invokeCompletion?: typeof chatCompletion,
 *   logger?: Pick<Console, 'info' | 'warn'>,
 * }} params
 */
export async function runDiagnosisAgent({
  payload,
  relatedCases = [],
  playbook = null,
  topWorks = [],
  env = getEnv(),
  invokeCompletion = chatCompletion,
  logger = console,
}) {
  const model = env.LLM_DIAGNOSIS_MODEL?.trim() || env.LLM_MODEL;
  const timeoutMs = env.DIAGNOSIS_AGENT_TIMEOUT_MS || env.LLM_DIAGNOSIS_TIMEOUT_MS;
  const retries = Number.isFinite(Number(env.DIAGNOSIS_AGENT_MAX_RETRIES))
    ? Math.max(0, Number(env.DIAGNOSIS_AGENT_MAX_RETRIES))
    : 1;

  const state = {
    context: null,
    hypotheses: null,
    checks: null,
    final: null,
  };

  try {
    const rawContext = await runStep({
      stepName: 'context_extraction',
      systemPrompt: AGENT_CONTEXT_SYSTEM_PROMPT,
      userPrompt: agentContextUserPrompt(payload, relatedCases, playbook, topWorks),
      format: AGENT_CONTEXT_FORMAT_SCHEMA,
      timeoutMs,
      retries,
      model,
      env,
      invokeCompletion,
      logger,
    });
    state.context = contextSchema.parse(rawContext);
  } catch (err) {
    logger.warn?.({
      event: 'agent_step_fallback',
      step: 'context_extraction',
      fallback: 'heuristic_context',
      error: String(err?.message || err),
    });
    state.context = contextSchema.parse({
      normalized_symptoms: payload?.symptoms ? String(payload.symptoms) : null,
      normalized_conditions: payload?.conditions ? String(payload.conditions) : null,
      inferred_intent: 'unknown',
      key_signals: [],
      missing_data: [],
    });
  }

  try {
    const rawHypotheses = await runStep({
      stepName: 'hypotheses',
      systemPrompt: AGENT_HYPOTHESES_SYSTEM_PROMPT,
      userPrompt: agentHypothesesUserPrompt(payload, state.context),
      format: AGENT_HYPOTHESES_FORMAT_SCHEMA,
      timeoutMs,
      retries,
      model,
      env,
      invokeCompletion,
      logger,
    });
    state.hypotheses = hypothesesSchema.parse(rawHypotheses);
  } catch (err) {
    logger.warn?.({
      event: 'agent_step_fallback',
      step: 'hypotheses',
      fallback: 'fallback_hypotheses',
      error: String(err?.message || err),
    });
    state.hypotheses = hypothesesSchema.parse(fallbackHypotheses(state));
  }

  try {
    const rawChecks = await runStep({
      stepName: 'checks_planning',
      systemPrompt: AGENT_CHECKS_SYSTEM_PROMPT,
      userPrompt: agentChecksUserPrompt(payload, state.context, state.hypotheses),
      format: AGENT_CHECKS_FORMAT_SCHEMA,
      timeoutMs,
      retries,
      model,
      env,
      invokeCompletion,
      logger,
    });
    state.checks = checksSchema.parse(rawChecks);
  } catch (err) {
    logger.warn?.({
      event: 'agent_step_fallback',
      step: 'checks_planning',
      fallback: 'fallback_checks',
      error: String(err?.message || err),
    });
    state.checks = checksSchema.parse(fallbackChecks(state));
  }

  try {
    const rawFinal = await runStep({
      stepName: 'final_synthesis',
      systemPrompt: AGENT_FINAL_SYSTEM_PROMPT,
      userPrompt: agentFinalUserPrompt(payload, state.context, state.hypotheses, state.checks),
      format: AGENT_FINAL_FORMAT_SCHEMA,
      timeoutMs,
      retries,
      model,
      env,
      invokeCompletion,
      logger,
    });
    state.final = finalSchema.parse(rawFinal);
  } catch (err) {
    logger.warn?.({
      event: 'agent_step_fallback',
      step: 'final_synthesis',
      fallback: 'fallback_final',
      error: String(err?.message || err),
    });
    state.final = finalSchema.parse(fallbackFinal(state));
  }

  return {
    diagnosis: normalizeDiagnosisContract(state.final),
    trace: {
      context: state.context,
      hypotheses: state.hypotheses,
      checks: state.checks,
    },
  };
}
