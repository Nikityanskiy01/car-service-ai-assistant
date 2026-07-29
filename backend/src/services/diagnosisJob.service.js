import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { getEnv } from '../config/env.js';
import prisma from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

const QUEUE_NAME = 'consultation-diagnosis';

/** @type {IORedis | null} */
let redisConnection = null;
/** @type {Queue | null} */
let bullQueue = null;

function getRedisUrl() {
  const env = getEnv();
  return String(env.REDIS_URL || '').trim() || null;
}

export function shouldUseAsyncDiagnosis() {
  const env = getEnv();
  return env.DIAGNOSIS_ASYNC_ENABLED && Boolean(getRedisUrl());
}

function getRedisConnection() {
  const url = getRedisUrl();
  if (!url) return null;
  if (!redisConnection) {
    redisConnection = new IORedis(url, { maxRetriesPerRequest: null });
  }
  return redisConnection;
}

function getBullQueue() {
  if (!shouldUseAsyncDiagnosis()) return null;
  if (!bullQueue) {
    const connection = getRedisConnection();
    if (!connection) return null;
    bullQueue = new Queue(QUEUE_NAME, { connection });
  }
  return bullQueue;
}

export function serializeDiagnosisJob(row) {
  if (!row) return null;
  return {
    id: row.id,
    sessionId: row.sessionId,
    status: row.status,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    hasResult: Boolean(row.resultJson),
  };
}

export async function getDiagnosisJobForSession(sessionId) {
  const row = await prisma.consultationDiagnosisJob.findUnique({ where: { sessionId } });
  return serializeDiagnosisJob(row);
}

/**
 * @param {string} sessionId
 * @param {Record<string, unknown>} payload
 */
export async function createAndEnqueueDiagnosisJob(sessionId, payload) {
  const row = await prisma.consultationDiagnosisJob.upsert({
    where: { sessionId },
    create: {
      sessionId,
      status: 'PENDING',
      payloadJson: payload,
    },
    update: {
      status: 'PENDING',
      payloadJson: payload,
      resultJson: null,
      errorMessage: null,
      bullJobId: null,
    },
  });

  const queue = getBullQueue();
  if (!queue) {
    throw new Error('Async diagnosis queue is not configured (REDIS_URL required)');
  }

  const bullJob = await queue.add(
    'diagnose',
    { jobId: row.id, sessionId },
    {
      jobId: row.id,
      removeOnComplete: 100,
      removeOnFail: 200,
      attempts: 2,
      backoff: { type: 'exponential', delay: 3000 },
    },
  );

  await prisma.consultationDiagnosisJob.update({
    where: { id: row.id },
    data: { bullJobId: String(bullJob.id) },
  });

  logger.info({ sessionId, jobId: row.id }, 'diagnosis job enqueued');
  return serializeDiagnosisJob(row);
}

export async function markDiagnosisJobProcessing(jobId) {
  await prisma.consultationDiagnosisJob.update({
    where: { id: jobId },
    data: { status: 'PROCESSING' },
  });
}

export async function markDiagnosisJobCompleted(jobId, result) {
  await prisma.consultationDiagnosisJob.update({
    where: { id: jobId },
    data: {
      status: 'COMPLETED',
      resultJson: result,
      errorMessage: null,
    },
  });
}

export async function markDiagnosisJobFailed(jobId, errorMessage) {
  await prisma.consultationDiagnosisJob.update({
    where: { id: jobId },
    data: {
      status: 'FAILED',
      errorMessage: String(errorMessage || 'unknown').slice(0, 500),
    },
  });
}

export async function loadDiagnosisJobPayload(jobId) {
  const row = await prisma.consultationDiagnosisJob.findUnique({ where: { id: jobId } });
  if (!row) return null;
  return row.payloadJson;
}

export function getDiagnosisQueueRuntimeSnapshot() {
  const env = getEnv();
  const redisUrl = getRedisUrl();
  return {
    mode: shouldUseAsyncDiagnosis() ? 'bullmq' : redisUrl ? 'redis_only' : 'in_memory',
    asyncEnabled: env.DIAGNOSIS_ASYNC_ENABLED,
    redisConfigured: Boolean(redisUrl),
    queueName: QUEUE_NAME,
  };
}

export async function closeDiagnosisQueue() {
  if (bullQueue) {
    await bullQueue.close();
    bullQueue = null;
  }
  if (redisConnection) {
    await redisConnection.quit();
    redisConnection = null;
  }
}

export { QUEUE_NAME, getRedisConnection };
