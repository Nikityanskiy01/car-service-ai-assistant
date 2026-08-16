import { Worker } from 'bullmq';
import { getEnv } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { generateDiagnosisCore, buildPlaybookFallbackDiagnosis, preAnalyzeSymptoms } from '../modules/consultations/consultationAi.service.js';
import { enrichRuleBasedWithPlaybook, pickPlaybook } from '../lib/diagnosticPlaybooks.js';
import { finalizeDiagnosisForSession } from '../modules/consultations/consultations.service.js';
import {
  loadDiagnosisJobPayload,
  markDiagnosisJobCompleted,
  markDiagnosisJobFailed,
  markDiagnosisJobProcessing,
  QUEUE_NAME,
  shouldUseAsyncDiagnosis,
  getRedisConnection,
} from './diagnosisJob.service.js';

/** @type */
let worker = null;

async function processDiagnosisJob(bullJob) {
  const { jobId, sessionId } = bullJob.data || {};
  if (!jobId || !sessionId) {
    throw new Error('Invalid diagnosis job payload');
  }

  await markDiagnosisJobProcessing(jobId);
  const payload = (await loadDiagnosisJobPayload(jobId)) as Record<string, unknown> | null;
  if (!payload || typeof payload !== 'object') {
    throw new Error('Diagnosis job payload not found');
  }

  try {
    const diagnosis = await generateDiagnosisCore(payload);
    await finalizeDiagnosisForSession(sessionId, diagnosis, payload);
    await markDiagnosisJobCompleted(jobId, diagnosis);
    logger.info({ sessionId, jobId }, 'async diagnosis completed');
    return { sessionId, status: diagnosis?.status || 'SUCCESS' };
  } catch (err) {
    const symptoms = String(payload.symptoms || '');
    const conditions = String(payload.conditions || '');
    const pb = pickPlaybook(payload, symptoms);
    const ruleBased = enrichRuleBasedWithPlaybook(preAnalyzeSymptoms(payload), pb, `${symptoms} ${conditions}`);
    const fallback = buildPlaybookFallbackDiagnosis({
      reason: 'LLM_UNAVAILABLE',
      ruleBased,
      playbook: pb,
      payload,
    });
    try {
      await finalizeDiagnosisForSession(sessionId, fallback, payload);
      await markDiagnosisJobCompleted(jobId, fallback);
      logger.warn({ sessionId, jobId, err: err instanceof Error ? err.message : String(err) }, 'async diagnosis fallback');
      return { sessionId, status: fallback?.status || 'SUCCESS' };
    } catch (fatal) {
      await markDiagnosisJobFailed(jobId, fatal instanceof Error ? fatal.message : String(fatal));
      throw fatal;
    }
  }
}

export function startDiagnosisWorker() {
  if (worker || !shouldUseAsyncDiagnosis()) return worker;

  const env = getEnv();
  const connection = getRedisConnection();
  if (!connection) return null;

  worker = new Worker(QUEUE_NAME, processDiagnosisJob, {
    connection,
    concurrency: Math.max(1, env.DIAGNOSIS_QUEUE_CONCURRENCY),
  });

  worker.on('failed', (job, err) => {
    const jobId = job?.data?.jobId;
    const sessionId = job?.data?.sessionId;
    logger.error(
      { jobId, sessionId, err: err instanceof Error ? err.message : String(err) },
      'async diagnosis job failed',
    );
    if (jobId) {
      void markDiagnosisJobFailed(jobId, err instanceof Error ? err.message : String(err));
    }
  });

  worker.on('error', (err) => {
    logger.error({ err: err instanceof Error ? err.message : String(err) }, 'diagnosis worker error');
  });

  logger.info({ concurrency: env.DIAGNOSIS_QUEUE_CONCURRENCY }, 'diagnosis BullMQ worker started');
  return worker;
}

export async function stopDiagnosisWorker() {
  if (!worker) return;
  await worker.close();
  worker = null;
  logger.info('diagnosis BullMQ worker stopped');
}
