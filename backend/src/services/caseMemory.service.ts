import prisma from '../lib/prisma.js';
import { getEnv } from '../config/env.js';
import { cosineSimilarity, toFloatVector } from '../lib/vectorMath.js';
import { createEmbedding } from './embeddingService.js';
import { buildCaseMemoryDocument } from './caseMemoryIndexer.service.js';
import { detectSymptomCategory } from './symptomClassifier.js';
import { logger } from '../lib/logger.js';
import { isPgvectorAvailable, searchEmbeddingNeighbors } from '../lib/pgvector.js';

function tokenizeRu(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-zа-я0-9\s]/gi, ' ')
    .split(/\s+/)
    .map((x) => x.trim())
    .filter((x) => x.length >= 3);
}

function overlapScore(a, b) {
  const sa = new Set(tokenizeRu(a));
  const sb = new Set(tokenizeRu(b));
  if (!sa.size || !sb.size) return 0;
  let inter = 0;
  for (const t of sa) if (sb.has(t)) inter++;
  return inter / Math.sqrt(sa.size * sb.size);
}

function sameText(a, b) {
  return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
}

function recencyScore(updatedAt) {
  const ts = updatedAt instanceof Date ? updatedAt.getTime() : new Date(updatedAt).getTime();
  if (!Number.isFinite(ts)) return 0;
  const ageDays = Math.max(0, (Date.now() - ts) / (1000 * 60 * 60 * 24));
  if (ageDays <= 14) return 0.12;
  if (ageDays <= 60) return 0.08;
  if (ageDays <= 180) return 0.04;
  return 0;
}

function categoryBoost(wanted, src) {
  return wanted !== 'unknown' && src === wanted ? 0.1 : 0;
}

function vehicleBoost(wantedMake, wantedModel, make, model) {
  let boost = 0;
  if (wantedMake && sameText(wantedMake, make)) boost += 0.08;
  if (wantedModel && sameText(wantedModel, model)) boost += 0.06;
  return boost;
}

/**
 * @param row
 * @returns
 */
function toAnonymizedCase(row) {
  const recs = Array.isArray(row?.topRecommendations)
    ? row.topRecommendations.map((x) => String(x).slice(0, 120)).filter(Boolean)
    : [];
  return {
    make: row?.make || null,
    model: row?.model || null,
    symptomCategory: row?.symptomCategory || null,
    topRecommendations: recs.slice(0, 3),
    costFromMinor: row?.costFromMinor ?? null,
  };
}

/**
 * Lexical retrieval (legacy).
 * @param data
 * @param limit
 */
export async function getRelevantCasesLexical(data, limit = 3) {
  const query = `${data?.symptoms || ''} ${data?.conditions || ''}`.trim();
  const wantedCategory = detectSymptomCategory(String(data?.symptoms || ''));
  const wantedMake = String(data?.car_make || '').trim();
  const wantedModel = String(data?.car_model || '').trim();

  // Narrow SQL prefilter — avoid loading 220 full sessions on every diagnosis.
  const orFilters = [];
  if (wantedMake) {
    orFilters.push({ extracted: { make: { equals: wantedMake, mode: 'insensitive' } } });
  }
  if (query) {
    const tokens = tokenizeRu(query).slice(0, 4);
    for (const token of tokens) {
      orFilters.push({ extracted: { symptoms: { contains: token, mode: 'insensitive' } } });
      orFilters.push({ extracted: { problemConditions: { contains: token, mode: 'insensitive' } } });
    }
  }

  const rows = await prisma.consultationSession.findMany({
    where: {
      status: 'COMPLETED',
      extracted: { isNot: null },
      ...(orFilters.length ? { OR: orFilters } : {}),
    },
    orderBy: { updatedAt: 'desc' },
    take: 80,
    select: {
      updatedAt: true,
      costFromMinor: true,
      extracted: {
        select: {
          make: true,
          model: true,
          symptoms: true,
          problemConditions: true,
        },
      },
      recommendations: {
        select: { title: true },
        take: 3,
        orderBy: { probabilityPercent: 'desc' },
      },
    },
  });

  const wantedMakeLc = wantedMake.toLowerCase();
  const wantedModelLc = wantedModel.toLowerCase();

  return rows
    .map((s) => {
      const src = `${s?.extracted?.symptoms || ''} ${s?.extracted?.problemConditions || ''}`.trim();
      const srcCategory = detectSymptomCategory(String(s?.extracted?.symptoms || ''));
      const score =
        overlapScore(query, src) +
        categoryBoost(wantedCategory, srcCategory) +
        vehicleBoost(wantedMakeLc, wantedModelLc, s?.extracted?.make, s?.extracted?.model) +
        recencyScore(s?.updatedAt);
      return {
        score,
        case: {
          make: s?.extracted?.make || null,
          model: s?.extracted?.model || null,
          symptomCategory: srcCategory !== 'unknown' ? srcCategory : null,
          topRecommendations: (s.recommendations || [])
            .slice(0, 3)
            .map((r) => String(r.title || '').slice(0, 120))
            .filter(Boolean),
          costFromMinor: s.costFromMinor ?? null,
        },
      };
    })
    .filter((x) => x.score > 0.14)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.case);
}

/**
 * Semantic retrieval via stored embeddings.
 * @param data
 * @param limit
 */
export async function getRelevantCasesSemantic(data, limit = 5) {
  const env = getEnv();
  if (!env.CASE_MEMORY_SEMANTIC_ENABLED) return [];

  const document = buildCaseMemoryDocument(data);
  if (!document.trim()) return [];

  const queryVec = await createEmbedding(document);
  if (!queryVec.length) return [];

  const wantedCategory = detectSymptomCategory(String(data?.symptoms || ''));
  const wantedMake = String(data?.car_make || '').trim().toLowerCase();
  const wantedModel = String(data?.car_model || '').trim().toLowerCase();
  const maxScan = Math.max(8, Number(env.CASE_MEMORY_MAX_SCAN) || 80);

  const rank = (rows) =>
    rows
      .map((row) => {
        const semantic =
          typeof row.semantic === 'number' ? row.semantic : cosineSimilarity(queryVec, toFloatVector(row.embedding));
        const score =
          semantic +
          categoryBoost(wantedCategory, String(row.symptomCategory || 'unknown')) +
          vehicleBoost(wantedMake, wantedModel, row.make, row.model) +
          recencyScore(row.updatedAt);
        return { score, case: toAnonymizedCase(row) };
      })
      .filter((x) => x.score > 0.35)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((x) => x.case);

  if (env.CASE_MEMORY_PGVECTOR_ENABLED && (await isPgvectorAvailable())) {
    const neighbors = await searchEmbeddingNeighbors(queryVec, { wantedCategory, limit });
    if (neighbors.length) return rank(neighbors);
  }

  const categoryRows =
    wantedCategory !== 'unknown'
      ? await prisma.consultationCaseEmbedding.findMany({
          where: { symptomCategory: wantedCategory },
          orderBy: { updatedAt: 'desc' },
          take: maxScan,
          select: {
            make: true,
            model: true,
            symptomCategory: true,
            topRecommendations: true,
            costFromMinor: true,
            embedding: true,
            updatedAt: true,
          },
        })
      : [];

  const needMore = Math.max(0, maxScan - categoryRows.length);
  const recentRows =
    needMore > 0
      ? await prisma.consultationCaseEmbedding.findMany({
          where:
            wantedCategory !== 'unknown' && categoryRows.length
              ? { symptomCategory: { not: wantedCategory } }
              : undefined,
          orderBy: { updatedAt: 'desc' },
          take: needMore,
          select: {
            make: true,
            model: true,
            symptomCategory: true,
            topRecommendations: true,
            costFromMinor: true,
            embedding: true,
            updatedAt: true,
          },
        })
      : [];

  const rows = categoryRows.concat(recentRows);
  if (!rows.length) return [];
  return rank(rows);
}

/**
 * Hybrid: semantic first, lexical fallback / merge.
 * @param data
 * @param [limit]
 */
export async function getRelevantCases(data, limit = undefined) {
  const env = getEnv();
  const topK = Number.isFinite(limit) ? limit : env.CASE_MEMORY_TOP_K;

  let semantic = [];
  try {
    semantic = await getRelevantCasesSemantic(data, topK);
  } catch (err) {
    logger.warn({ err: err instanceof Error ? err.message : String(err) }, 'semantic case memory failed');
  }

  if (semantic.length >= topK || !env.CASE_MEMORY_LEXICAL_FALLBACK) {
    return semantic.slice(0, topK);
  }

  let lexical = [];
  try {
    lexical = await getRelevantCasesLexical(data, topK);
  } catch (err) {
    logger.warn({ err: err instanceof Error ? err.message : String(err) }, 'lexical case memory failed');
  }

  const merged = [];
  const seen = new Set();
  const push = (item) => {
    const key = `${item.make}|${item.model}|${item.symptomCategory}|${(item.topRecommendations || []).join(',')}`;
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(item);
  };

  for (const item of semantic) push(item);
  for (const item of lexical) push(item);

  return merged.slice(0, topK);
}
