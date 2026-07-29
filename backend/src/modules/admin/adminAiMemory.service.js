import prisma from '../../lib/prisma.js';
import { getEnv } from '../../config/env.js';
import { backfillConsultationCases } from '../../services/caseMemoryIndexer.service.js';
import { getRelevantCasesLexical } from '../../services/caseMemory.service.js';
import { buildCaseMemoryDocument } from '../../services/caseMemoryIndexer.service.js';
import { cosineSimilarity, toFloatVector } from '../../lib/vectorMath.js';
import { createEmbedding } from '../../services/embeddingService.js';
import { detectSymptomCategory } from '../../services/symptomClassifier.js';

export async function getCaseMemoryStats() {
  const env = getEnv();
  const [indexed, completed, lastRow] = await Promise.all([
    prisma.consultationCaseEmbedding.count(),
    prisma.consultationSession.count({ where: { status: 'COMPLETED' } }),
    prisma.consultationCaseEmbedding.findFirst({
      orderBy: { updatedAt: 'desc' },
      select: { updatedAt: true },
    }),
  ]);

  return {
    indexedSessions: indexed,
    completedSessions: completed,
    coveragePercent: completed ? Math.round((indexed / completed) * 100) : 0,
    semanticEnabled: Boolean(env.CASE_MEMORY_SEMANTIC_ENABLED),
    lexicalFallback: Boolean(env.CASE_MEMORY_LEXICAL_FALLBACK),
    embeddingModel: env.LLM_EMBEDDING_MODEL || null,
    topK: env.CASE_MEMORY_TOP_K,
    lastIndexedAt: lastRow?.updatedAt?.toISOString() || null,
  };
}

/**
 * Admin semantic search with scores for UI.
 * @param {{ symptoms?: string, make?: string, model?: string, conditions?: string, limit?: number }} input
 */
export async function searchCaseMemory(input) {
  const limit = Math.min(Math.max(Number(input.limit) || 5, 1), 20);
  const data = {
    symptoms: input.symptoms || '',
    car_make: input.make || null,
    car_model: input.model || null,
    conditions: input.conditions || null,
  };

  const document = buildCaseMemoryDocument(data);
  const env = getEnv();
  const results = [];

  if (env.CASE_MEMORY_SEMANTIC_ENABLED && document.trim()) {
    try {
      const queryVec = await createEmbedding(document);
      if (queryVec.length) {
        const rows = await prisma.consultationCaseEmbedding.findMany({
          orderBy: { updatedAt: 'desc' },
          take: 400,
        });
        const wantedCategory = detectSymptomCategory(String(data.symptoms || ''));
        for (const row of rows) {
          const vec = toFloatVector(row.embedding);
          const semantic = cosineSimilarity(queryVec, vec);
          const score = semantic;
          if (score <= 0.1) continue;
          results.push({
            score: Math.round(score * 1000) / 1000,
            source: 'semantic',
            make: row.make,
            model: row.model,
            symptomCategory: row.symptomCategory,
            topRecommendations: Array.isArray(row.topRecommendations) ? row.topRecommendations : [],
            costFromMinor: row.costFromMinor,
            categoryMatch:
              wantedCategory !== 'unknown' && row.symptomCategory === wantedCategory,
          });
        }
      }
    } catch {
      /* semantic optional */
    }
  }

  if (results.length < limit && env.CASE_MEMORY_LEXICAL_FALLBACK) {
    const lexical = await getRelevantCasesLexical(data, limit);
    for (const item of lexical) {
      results.push({
        score: null,
        source: 'lexical',
        make: item.make,
        model: item.model,
        symptomCategory: item.symptomCategory,
        topRecommendations: item.topRecommendations || [],
        costFromMinor: item.costFromMinor,
        categoryMatch: false,
      });
    }
  }

  const deduped = [];
  const seen = new Set();
  for (const row of results.sort((a, b) => (b.score ?? 0) - (a.score ?? 0))) {
    const key = `${row.make}|${row.model}|${row.symptomCategory}|${(row.topRecommendations || []).join(',')}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(row);
    if (deduped.length >= limit) break;
  }

  return {
    query: document,
    semanticEnabled: Boolean(env.CASE_MEMORY_SEMANTIC_ENABLED),
    results: deduped,
  };
}

/**
 * @param {{ limit?: number, dryRun?: boolean }} options
 */
export async function runCaseMemoryBackfill(options = {}) {
  return backfillConsultationCases(options);
}
