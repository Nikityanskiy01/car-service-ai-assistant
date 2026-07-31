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
