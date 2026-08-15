import { getEnv } from '../config/env.js';
import { logger } from './logger.js';
import prisma from './prisma.js';
import { toVectorLiteral } from './vectorLiteral.js';

let cachedAvailable;

export function resetPgvectorAvailabilityCache() {
  cachedAvailable = undefined;
}

/**
 * @returns {Promise<boolean>}
 */
export async function isPgvectorAvailable() {
  if (cachedAvailable !== undefined) return cachedAvailable;
  try {
    const rows = await prisma.$queryRaw`SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') AS ok`;
    cachedAvailable = Boolean(rows?.[0]?.ok);
  } catch {
    cachedAvailable = false;
  }
  return cachedAvailable;
}

/**
 * Dual-write ANN column. Skipped in tests and when dims do not match the index.
 * @param {string} sessionId
 * @param {number[]} vec
 */
export async function writeEmbeddingVec(sessionId, vec) {
  const env = getEnv();
  if (!env.CASE_MEMORY_PGVECTOR_ENABLED) return false;
  if (process.env.NODE_ENV === 'test') return false;
  if (!Array.isArray(vec) || vec.length !== env.CASE_MEMORY_VECTOR_DIMS) return false;
  if (!(await isPgvectorAvailable())) return false;
  const literal = toVectorLiteral(vec);
  if (!literal) return false;
  try {
    await prisma.$executeRawUnsafe(
      `UPDATE consultation_case_embeddings SET embedding_vec = $1::vector(768) WHERE session_id = $2`,
      literal,
      sessionId,
    );
    return true;
  } catch (err) {
    logger.warn(
      { sessionId, err: err instanceof Error ? err.message : String(err) },
      'pgvector write failed',
    );
    return false;
  }
}

/**
 * ANN neighbors via cosine distance. Returns rows with semantic similarity in [0, 1].
 * @param {number[]} queryVec
 * @param {{ wantedCategory?: string, limit: number }} opts
 */
export async function searchEmbeddingNeighbors(queryVec, opts) {
  const env = getEnv();
  const limit = Math.max(1, Number(opts.limit) || env.CASE_MEMORY_TOP_K);
  if (!env.CASE_MEMORY_PGVECTOR_ENABLED) return [];
  if (!(await isPgvectorAvailable())) return [];
  if (!Array.isArray(queryVec) || queryVec.length !== env.CASE_MEMORY_VECTOR_DIMS) return [];
  const literal = toVectorLiteral(queryVec);
  if (!literal) return [];

  const fetchLimit = Math.min(Math.max(limit * 8, 16), 64);
  const cat =
    opts.wantedCategory && opts.wantedCategory !== 'unknown' ? String(opts.wantedCategory) : '';

  try {
    const rows = await prisma.$queryRawUnsafe(
      `
      SELECT
        make,
        model,
        symptom_category AS "symptomCategory",
        top_recommendations AS "topRecommendations",
        cost_from_minor AS "costFromMinor",
        updated_at AS "updatedAt",
        (1 - (embedding_vec <=> $1::vector(768)))::float8 AS semantic
      FROM consultation_case_embeddings
      WHERE embedding_vec IS NOT NULL
        AND vector_dims(embedding_vec) = $2
      ORDER BY
        CASE WHEN $3 <> '' AND symptom_category = $3 THEN 0 ELSE 1 END,
        embedding_vec <=> $1::vector(768)
      LIMIT $4
      `,
      literal,
      env.CASE_MEMORY_VECTOR_DIMS,
      cat,
      fetchLimit,
    );
    return Array.isArray(rows) ? rows : [];
  } catch (err) {
    logger.warn({ err: err instanceof Error ? err.message : String(err) }, 'pgvector search failed');
    return [];
  }
}
