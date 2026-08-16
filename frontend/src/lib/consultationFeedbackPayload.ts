import type { ConsultationFeedbackInput } from '../api/dashboard/followup';
import type { ConsultationFeedback, ConsultationFeedbackVerdict } from '../types/serviceRequest';

type FeedbackPatch = {
  verdict?: ConsultationFeedbackVerdict | null;
  actualCause?: string;
  worksDone?: string;
  repairAmountRub?: string;
  workOrderNumber?: string;
  repairCompletedAt?: string;
  repairMileageKm?: string;
  workCategory?: string;
};

function isoOrNull(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Склеивает оценку и работы, чтобы сохранение одной половины не затирало другую. */
export function toFeedbackPayload(
  initial: ConsultationFeedback | null | undefined,
  patch: FeedbackPatch,
): ConsultationFeedbackInput | null {
  const verdict = patch.verdict ?? initial?.verdict ?? null;
  if (!verdict) return null;

  const actualCause =
    patch.actualCause !== undefined ? patch.actualCause.trim() : (initial?.actualCause ?? '');
  const worksDone = patch.worksDone !== undefined ? patch.worksDone.trim() : (initial?.worksDone ?? '');
  const repairAmountMinor =
    patch.repairAmountRub !== undefined
      ? patch.repairAmountRub.trim()
        ? Math.round(Number(patch.repairAmountRub) * 100)
        : null
      : (initial?.repairAmountMinor ?? null);
  const workOrderNumber =
    patch.workOrderNumber !== undefined
      ? patch.workOrderNumber.trim() || null
      : (initial?.workOrderNumber ?? null);
  const repairCompletedAt =
    patch.repairCompletedAt !== undefined
      ? isoOrNull(patch.repairCompletedAt)
      : (initial?.repairCompletedAt ?? null);
  const repairMileageKm =
    patch.repairMileageKm !== undefined
      ? patch.repairMileageKm.trim()
        ? Number(patch.repairMileageKm)
        : null
      : (initial?.repairMileageKm ?? null);
  const workCategory =
    patch.workCategory !== undefined ? patch.workCategory || 'other' : initial?.workCategory || 'other';

  return {
    verdict,
    actualCause: actualCause || undefined,
    worksDone: worksDone || undefined,
    repairAmountMinor,
    workOrderNumber,
    repairCompletedAt,
    repairMileageKm,
    workCategory,
  };
}
