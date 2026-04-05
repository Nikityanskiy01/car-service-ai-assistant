import prisma from '../lib/prisma.js';
import { detectSymptomCategory } from './symptomClassifier.js';

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
  if (ageDays <= 14) return 0.25;
  if (ageDays <= 60) return 0.15;
  if (ageDays <= 180) return 0.08;
  return 0;
}

/**
 * Retrieve similar completed consultations to guide diagnosis prompt.
 * @param {{ car_make?: string | null, car_model?: string | null, symptoms?: string | null, conditions?: string | null }} data
 * @param {number} limit
 */
export async function getRelevantCases(data, limit = 3) {
  const where = { status: 'COMPLETED' };
  const rows = await prisma.consultationSession.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    take: 220,
    include: {
      extracted: true,
      recommendations: true,
    },
  });

  const query = `${data?.symptoms || ''} ${data?.conditions || ''}`.trim();
  const wantedCategory = detectSymptomCategory(String(data?.symptoms || ''));
  const wantedMake = String(data?.car_make || '').trim().toLowerCase();
  const wantedModel = String(data?.car_model || '').trim().toLowerCase();
  const scored = rows
    .map((s) => {
      const src = `${s?.extracted?.symptoms || ''} ${s?.extracted?.problemConditions || ''}`.trim();
      const baseScore = overlapScore(query, src);
      const srcCategory = detectSymptomCategory(String(s?.extracted?.symptoms || ''));
      const categoryBoost =
        wantedCategory !== 'unknown' && srcCategory === wantedCategory ? 0.22 : 0;
      const makeBoost = wantedMake && sameText(wantedMake, s?.extracted?.make) ? 0.2 : 0;
      const modelBoost = wantedModel && sameText(wantedModel, s?.extracted?.model) ? 0.16 : 0;
      const freshBoost = recencyScore(s?.updatedAt);
      const score = baseScore + categoryBoost + makeBoost + modelBoost + freshBoost;
      return {
        score,
        case: {
          make: s?.extracted?.make || null,
          model: s?.extracted?.model || null,
          symptoms: s?.extracted?.symptoms || null,
          conditions: s?.extracted?.problemConditions || null,
          topRecommendations: (s.recommendations || []).slice(0, 3).map((r) => r.title),
          costFromMinor: s.costFromMinor ?? null,
        },
      };
    })
    .filter((x) => x.score > 0.16)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.case);

  return scored;
}
