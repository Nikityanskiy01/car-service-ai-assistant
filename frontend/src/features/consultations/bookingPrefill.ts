import { STORAGE_KEYS } from '../../lib/storageKeys';
import type { ConsultationDetail } from '../../types/consultation';

export function prefillConsultationBooking(detail: ConsultationDetail | null | undefined) {
  if (!detail) return;
  const make = detail.extracted?.make?.trim() || '';
  const model = detail.extracted?.model?.trim() || '';
  const symptoms = detail.extracted?.symptoms?.trim() || '';
  const vehicle = [make, model].filter(Boolean).join(' ');
  const lines = [
    'Записаться после ИИ-диагностики.',
    vehicle ? `Авто: ${vehicle}` : null,
    symptoms ? `Симптомы: ${symptoms}` : null,
    detail.extracted?.obdCodes ? `Коды OBD: ${detail.extracted.obdCodes}` : null,
  ].filter(Boolean);

  sessionStorage.setItem(
    STORAGE_KEYS.bookingPrefill,
    JSON.stringify({
      serviceTitle: 'Комплексная диагностика',
      categoryLabel: 'Диагностика',
      consultationSummary: lines.join('\n'),
      fromConsultation: true,
    }),
  );
}

export function prefillOilChangeBooking(detail: ConsultationDetail | null | undefined) {
  const make = detail?.extracted?.make?.trim() || '';
  const model = detail?.extracted?.model?.trim() || '';
  const vehicle = [make, model].filter(Boolean).join(' ');
  const plan = detail?.flowState?.service_history_plan?.plan;
  const lines = [
    'Запись на замену масла ДВС.',
    vehicle ? `Авто: ${vehicle}` : null,
    plan?.nextDueAt
      ? `Рекомендуемый срок: ${new Date(plan.nextDueAt).toLocaleDateString('ru-RU')}`
      : null,
    plan?.nextDueMileage != null
      ? `Рекомендуемый пробег: ${plan.nextDueMileage.toLocaleString('ru-RU')} км`
      : null,
  ].filter(Boolean);

  sessionStorage.setItem(
    STORAGE_KEYS.bookingPrefill,
    JSON.stringify({
      serviceTitle: 'Замена масла ДВС',
      categoryLabel: 'ТО',
      consultationSummary: lines.join('\n'),
      fromConsultation: true,
    }),
  );
}

export function prefillOilChangeBookingFromPlan(input: {
  make?: string | null;
  model?: string | null;
  year?: number | null;
  nextDueAt?: string | null;
  nextDueMileage?: number | null;
}) {
  const vehicle = [input.make, input.model, input.year].filter(Boolean).join(' ');
  const lines = [
    'Запись на замену масла ДВС.',
    vehicle ? `Авто: ${vehicle}` : null,
    input.nextDueAt
      ? `Рекомендуемый срок: ${new Date(input.nextDueAt).toLocaleDateString('ru-RU')}`
      : null,
    input.nextDueMileage != null
      ? `Рекомендуемый пробег: ${input.nextDueMileage.toLocaleString('ru-RU')} км`
      : null,
  ].filter(Boolean);

  sessionStorage.setItem(
    STORAGE_KEYS.bookingPrefill,
    JSON.stringify({
      serviceTitle: 'Замена масла ДВС',
      categoryLabel: 'ТО',
      consultationSummary: lines.join('\n'),
      fromConsultation: false,
    }),
  );
}

