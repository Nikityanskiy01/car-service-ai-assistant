import prisma from '../lib/prisma.js';
import { detectSymptomCategory } from './symptomClassifier.js';
import { createEmbedding } from './embeddingService.js';
import { logger } from '../lib/logger.js';

/**
 * Текст для embedding: структурированные поля, без сырого чата.
 * @param {{
 *   symptoms?: string | null,
 *   conditions?: string | null,
 *   problemConditions?: string | null,
 *   car_make?: string | null,
 *   car_model?: string | null,
 *   make?: string | null,
 *   model?: string | null,
 * }} data
 * @param {string[]} topRecommendations
 */
export function buildCaseMemoryDocument(data, topRecommendations = []) {
  const symptoms = String(data?.symptoms || '').trim();
  const conditions = String(data?.conditions || data?.problemConditions || '').trim();
  const make = String(data?.car_make || data?.make || '').trim();
  const model = String(data?.car_model || data?.model || '').trim();
  const category = detectSymptomCategory(symptoms);
  const works = topRecommendations.filter(Boolean).slice(0, 5);

  const lines = [];
  if (category !== 'unknown') lines.push(`category: ${category}`);
  if (make) lines.push(`make: ${make}`);
  if (model) lines.push(`model: ${model}`);
  if (symptoms) lines.push(`symptoms: ${symptoms}`);
  if (conditions) lines.push(`conditions: ${conditions}`);
  if (works.length) lines.push(`works: ${works.join('; ')}`);
  return lines.join('\n');
}

/**
 * @param {string} sessionId
 */
export async function indexConsultationCase(sessionId) {
  const session = await prisma.consultationSession.findUnique({
    where: { id: sessionId },
    include: {
      extracted: true,
      recommendations: { orderBy: { probabilityPercent: 'desc' }, take: 5 },
    },
  });

  if (!session || session.status !== 'COMPLETED' || !session.extracted?.symptoms) {
    return null;
  }

  const topRecommendations = (session.recommendations || [])
    .map((r) => String(r.title || '').slice(0, 120))
    .filter(Boolean);

  const document = buildCaseMemoryDocument(
    {
      symptoms: session.extracted.symptoms,
      problemConditions: session.extracted.problemConditions,
      make: session.extracted.make,
      model: session.extracted.model,
    },
    topRecommendations,
  );

  if (!document.trim()) return null;

  const embedding = await createEmbedding(document);
  if (!embedding.length) return null;

  const symptomCategory = detectSymptomCategory(String(session.extracted.symptoms || ''));

  await prisma.consultationCaseEmbedding.upsert({
    where: { sessionId },
    create: {
      sessionId,
      symptomCategory: symptomCategory !== 'unknown' ? symptomCategory : null,
      make: session.extracted.make || null,
      model: session.extracted.model || null,
      topRecommendations,
      costFromMinor: session.costFromMinor ?? null,
      embedding,
      dimensions: embedding.length,
    },
    update: {
      symptomCategory: symptomCategory !== 'unknown' ? symptomCategory : null,
      make: session.extracted.make || null,
      model: session.extracted.model || null,
      topRecommendations,
      costFromMinor: session.costFromMinor ?? null,
      embedding,
      dimensions: embedding.length,
    },
  });

  logger.info({ sessionId, dimensions: embedding.length }, 'case memory indexed');
  return { sessionId, dimensions: embedding.length };
}

/**
 * @param {{ limit?: number, dryRun?: boolean }} [options]
 */
export async function backfillConsultationCases(options = {}) {
  const limit = Number(options.limit) > 0 ? Number(options.limit) : 500;
  const dryRun = Boolean(options.dryRun);

  const sessions = await prisma.consultationSession.findMany({
    where: { status: 'COMPLETED' },
    orderBy: { updatedAt: 'desc' },
    take: limit,
    select: { id: true },
  });

  let indexed = 0;
  let skipped = 0;
  for (const s of sessions) {
    if (dryRun) {
      indexed += 1;
      continue;
    }
    try {
      const out = await indexConsultationCase(s.id);
      if (out) indexed += 1;
      else skipped += 1;
    } catch (err) {
      skipped += 1;
      logger.warn({ sessionId: s.id, err: err instanceof Error ? err.message : String(err) }, 'backfill skip');
    }
  }

  return { total: sessions.length, indexed, skipped, dryRun };
}
