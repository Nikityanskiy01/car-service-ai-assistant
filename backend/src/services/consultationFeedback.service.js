import prisma from '../lib/prisma.js';
import { AppError } from '../lib/errors.js';
import { getEnv } from '../config/env.js';
import { createTtlCache } from '../lib/ttlCache.js';
import { inferCategoryFromText } from '../lib/maintenanceIntervals.js';
import { upsertFromManagerFeedback } from '../modules/serviceRecords/serviceRecords.service.js';
import { sanitizeUntrustedPromptText } from '../lib/piiRedact.js';

const fewShotCache = createTtlCache(10 * 60_000);

function serializeFeedback(row) {
  if (!row) return null;
  return {
    id: row.id,
    sessionId: row.sessionId,
    verdict: row.verdict,
    actualCause: row.actualCause,
    worksDone: row.worksDone,
    repairAmountMinor: row.repairAmountMinor,
    workOrderNumber: row.workOrderNumber,
    repairCompletedAt: row.repairCompletedAt?.toISOString?.() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    manager: row.manager
      ? {
          id: row.manager.id,
          fullName: row.manager.fullName,
        }
      : undefined,
  };
}

export function validateFeedbackInput({
  verdict,
  actualCause,
  worksDone,
  repairAmountMinor,
  workOrderNumber,
  repairCompletedAt,
  repairMileageKm,
  workCategory,
}) {
  const cause = String(actualCause || '').trim();
  const works = String(worksDone || '').trim();
  const orderNo = String(workOrderNumber || '').trim();
  if ((verdict === 'PARTIAL' || verdict === 'INCORRECT') && !cause) {
    throw new AppError(400, 'Укажите реальную причину для оценки «частично» или «неверно»', 'BAD_REQUEST');
  }
  let amount = null;
  if (repairAmountMinor != null && repairAmountMinor !== '') {
    const parsed = Number(repairAmountMinor);
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new AppError(400, 'Сумма ремонта должна быть неотрицательным числом', 'BAD_REQUEST');
    }
    amount = Math.round(parsed);
  }
  let repairDate = null;
  if (repairCompletedAt) {
    const d = new Date(repairCompletedAt);
    if (Number.isNaN(d.getTime())) {
      throw new AppError(400, 'Некорректная дата завершения ремонта', 'BAD_REQUEST');
    }
    repairDate = d;
  }
  let mileage = null;
  if (repairMileageKm != null && repairMileageKm !== '') {
    const parsed = Number(repairMileageKm);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 2_000_000) {
      throw new AppError(400, 'Некорректный пробег', 'BAD_REQUEST');
    }
    mileage = Math.round(parsed);
  }
  const allowedCategories = ['oil_change', 'maintenance', 'brakes', 'filters', 'tires', 'other'];
  let category = String(workCategory || '').trim() || null;
  if (category && !allowedCategories.includes(category)) {
    category = inferCategoryFromText(`${works} ${cause}`);
  }
  if (!category) {
    category = inferCategoryFromText(works);
  }
  return {
    verdict,
    actualCause: cause || null,
    worksDone: works || null,
    repairAmountMinor: amount,
    workOrderNumber: orderNo || null,
    repairCompletedAt: repairDate,
    repairMileageKm: mileage,
    workCategory: category,
  };
}

export async function upsertFeedbackForRequest(requestId, managerId, input) {
  const data = validateFeedbackInput(input);
  const sr = await prisma.serviceRequest.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      consultationSessionId: true,
      vehicleId: true,
      clientId: true,
      consultationSession: {
        select: {
          extracted: { select: { mileage: true } },
        },
      },
    },
  });
  if (!sr) throw new AppError(404, 'Запрошенные данные не найдены.', 'NOT_FOUND');

  // Store mileage/category on feedback via side-channel fields if schema has them;
  // otherwise only sync into VehicleServiceRecord.
  const row = await prisma.consultationFeedback.upsert({
    where: { sessionId: sr.consultationSessionId },
    create: {
      sessionId: sr.consultationSessionId,
      managerId,
      verdict: data.verdict,
      actualCause: data.actualCause,
      worksDone: data.worksDone,
      repairAmountMinor: data.repairAmountMinor,
      workOrderNumber: data.workOrderNumber,
      repairCompletedAt: data.repairCompletedAt,
    },
    update: {
      managerId,
      verdict: data.verdict,
      actualCause: data.actualCause,
      worksDone: data.worksDone,
      repairAmountMinor: data.repairAmountMinor,
      workOrderNumber: data.workOrderNumber,
      repairCompletedAt: data.repairCompletedAt,
    },
    include: {
      manager: { select: { id: true, fullName: true } },
    },
  });
  fewShotCache.clear();

  const mileage =
    data.repairMileageKm ?? sr.consultationSession?.extracted?.mileage ?? null;

  if (
    sr.vehicleId &&
    sr.clientId &&
    (data.worksDone || data.repairCompletedAt || data.workOrderNumber || data.repairAmountMinor)
  ) {
    try {
      await upsertFromManagerFeedback({
        feedbackId: row.id,
        managerId,
        serviceRequestId: sr.id,
        vehicleId: sr.vehicleId,
        clientId: sr.clientId,
        performedAt: data.repairCompletedAt || row.createdAt,
        mileageKm: mileage,
        worksDone: data.worksDone,
        workOrderNumber: data.workOrderNumber,
        amountMinor: data.repairAmountMinor,
        category: data.workCategory,
        title: null,
      });
    } catch (err) {
      const { logger } = await import('../lib/logger.js');
      logger.warn(
        { err: err instanceof Error ? err.message : String(err), requestId },
        'service record sync from feedback failed',
      );
    }
  }

  return {
    ...serializeFeedback(row),
    repairMileageKm: mileage,
    workCategory: data.workCategory,
  };
}

export async function getFeedbackForRequest(requestId) {
  const sr = await prisma.serviceRequest.findUnique({
    where: { id: requestId },
    select: { consultationSessionId: true },
  });
  if (!sr) throw new AppError(404, 'Запрошенные данные не найдены.', 'NOT_FOUND');

  const row = await prisma.consultationFeedback.findUnique({
    where: { sessionId: sr.consultationSessionId },
    include: {
      manager: { select: { id: true, fullName: true } },
    },
  });
  return serializeFeedback(row);
}

function resolveCategoryName(row) {
  const embeddingCategory = row.session?.caseEmbedding?.symptomCategory;
  if (embeddingCategory) return String(embeddingCategory);
  const serviceCategory = row.session?.serviceCategory?.name;
  if (serviceCategory) return String(serviceCategory);
  return 'Без категории';
}

export function buildAiFeedbackReport(rows, { days = 7 } = {}) {
  const total = rows.length;
  const byVerdict = { CORRECT: 0, PARTIAL: 0, INCORRECT: 0 };
  for (const row of rows) {
    if (byVerdict[row.verdict] != null) byVerdict[row.verdict] += 1;
  }

  const accuracyPercent = total ? Math.round((byVerdict.CORRECT / total) * 100) : 0;
  const usefulPercent = total
    ? Math.round(((byVerdict.CORRECT + byVerdict.PARTIAL) / total) * 100)
    : 0;

  const misdiagnosisCounts = new Map();
  const categoryCounts = new Map();

  for (const row of rows) {
    const category = resolveCategoryName(row);
    if (!categoryCounts.has(category)) {
      categoryCounts.set(category, { total: 0, incorrect: 0, partial: 0 });
    }
    const cat = categoryCounts.get(category);
    cat.total += 1;
    if (row.verdict === 'INCORRECT') cat.incorrect += 1;
    if (row.verdict === 'PARTIAL') cat.partial += 1;

    if (row.verdict === 'INCORRECT' || row.verdict === 'PARTIAL') {
      const key = String(row.actualCause || 'Причина не указана').trim().slice(0, 200);
      misdiagnosisCounts.set(key, (misdiagnosisCounts.get(key) || 0) + 1);
    }
  }

  const topMisdiagnoses = [...misdiagnosisCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([actualCause, count]) => ({ actualCause, count }));

  const topErrorCategories = [...categoryCounts.entries()]
    .map(([category, stats]) => ({
      category,
      total: stats.total,
      incorrect: stats.incorrect,
      partial: stats.partial,
      errorRatePercent: stats.total
        ? Math.round(((stats.incorrect + stats.partial) / stats.total) * 100)
        : 0,
    }))
    .sort((a, b) => b.errorRatePercent - a.errorRatePercent || b.total - a.total)
    .slice(0, 10);

  return {
    periodDays: days,
    totalFeedback: total,
    accuracyPercent,
    usefulPercent,
    byVerdict,
    topMisdiagnoses,
    topErrorCategories,
    recent: rows.slice(0, 20).map((row) => ({
      id: row.id,
      verdict: row.verdict,
      actualCause: row.actualCause,
      worksDone: row.worksDone,
      createdAt: row.createdAt.toISOString(),
      category: resolveCategoryName(row),
      vehicle: [row.session?.extracted?.make, row.session?.extracted?.model].filter(Boolean).join(' ') || null,
      managerName: row.manager?.fullName || null,
    })),
  };
}

export function buildAiFeedbackCsv(report) {
  const lines = ['metric,value'];
  lines.push(`period_days,${report.periodDays}`);
  lines.push(`total_feedback,${report.totalFeedback}`);
  lines.push(`accuracy_percent,${report.accuracyPercent}`);
  lines.push(`useful_percent,${report.usefulPercent}`);
  lines.push(`verdict_correct,${report.byVerdict.CORRECT}`);
  lines.push(`verdict_partial,${report.byVerdict.PARTIAL}`);
  lines.push(`verdict_incorrect,${report.byVerdict.INCORRECT}`);

  report.topMisdiagnoses.forEach((row, index) => {
    lines.push(`top_misdiagnosis_${index + 1},${csvEscape(row.actualCause)} (${row.count})`);
  });
  report.topErrorCategories.forEach((row, index) => {
    lines.push(
      `top_error_category_${index + 1},${csvEscape(row.category)} errors=${row.incorrect + row.partial} total=${row.total}`,
    );
  });
  return lines.join('\n');
}

function csvEscape(value) {
  return String(value || '')
    .replace(/"/g, '""')
    .replace(/\n/g, ' ');
}

export async function getAiFeedbackReport({ days = 7 } = {}) {
  const periodDays = Math.min(Math.max(1, Number(days) || 7), 365);
  const since = new Date();
  since.setDate(since.getDate() - periodDays);

  const rows = await prisma.consultationFeedback.findMany({
    where: { createdAt: { gte: since } },
    include: {
      manager: { select: { id: true, fullName: true } },
      session: {
        include: {
          extracted: true,
          serviceCategory: { select: { name: true } },
          caseEmbedding: { select: { symptomCategory: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return buildAiFeedbackReport(rows, { days: periodDays });
}

export async function getAiFeedbackCsv({ days = 7 } = {}) {
  const report = await getAiFeedbackReport({ days });
  return buildAiFeedbackCsv(report);
}

const FEW_SHOT_VERDICTS = new Set(['CORRECT', 'PARTIAL', 'INCORRECT']);

/** Structured few-shot only: no manager free text (actualCause / worksDone) and no client symptoms. */
export function formatFewShotExample(row) {
  const extracted = row.session?.extracted;
  const vehicle = [extracted?.make, extracted?.model]
    .map((part) => sanitizeUntrustedPromptText(part, 40))
    .filter(Boolean)
    .join(' ') || null;
  const category =
    sanitizeUntrustedPromptText(
      row.session?.serviceCategory?.name || row.session?.caseEmbedding?.symptomCategory || '',
      48,
    ) || null;
  const verdict = FEW_SHOT_VERDICTS.has(row.verdict) ? row.verdict : null;
  return { verdict, vehicle, category };
}

export async function getConfirmedFewShotExamples(limit) {
  const env = getEnv();
  if (!env.CONSULTATION_FEEDBACK_FEW_SHOT_ENABLED) return [];

  const take = Math.min(Math.max(1, Number(limit) || env.CONSULTATION_FEEDBACK_FEW_SHOT_LIMIT), 8);
  const cacheKey = `few-shot:${take}`;
  const cached = fewShotCache.get(cacheKey);
  if (cached) return cached;

  const rows = await prisma.consultationFeedback.findMany({
    where: {
      OR: [{ verdict: 'CORRECT' }, { verdict: 'PARTIAL', actualCause: { not: null } }],
    },
    include: {
      session: {
        include: {
          extracted: { select: { make: true, model: true } },
          serviceCategory: { select: { name: true } },
          caseEmbedding: { select: { symptomCategory: true } },
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
    take,
  });

  const examples = rows.map(formatFewShotExample).filter((x) => x.verdict);
  fewShotCache.set(cacheKey, examples);
  return examples;
}

export function invalidateFewShotCache() {
  fewShotCache.clear();
}
