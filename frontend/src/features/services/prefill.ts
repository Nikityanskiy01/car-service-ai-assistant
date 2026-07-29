import { STORAGE_KEYS } from '../../lib/storageKeys';
import type { ConsultationDetail } from '../../types/consultation';
import type { ServiceItem } from './types';

export function prefillService(item: Pick<ServiceItem, 'title' | 'category'>) {
  sessionStorage.setItem(
    STORAGE_KEYS.bookingPrefill,
    JSON.stringify({ serviceTitle: item.title, categoryLabel: item.category || '' }),
  );
}

export function buildConsultationBookingSummary(detail: ConsultationDetail | null): string {
  if (!detail) return 'Заявка после ИИ-диагностики';
  const parts: string[] = [];
  const extracted = detail.extracted;
  const vehicle = [extracted?.make, extracted?.model].filter(Boolean).join(' ');
  if (vehicle) parts.push(vehicle);
  if (extracted?.symptoms) parts.push(`Симптомы: ${extracted.symptoms}`);
  if (detail.diagnosis?.summary) parts.push(String(detail.diagnosis.summary));
  return parts.join('. ') || 'Заявка после ИИ-диагностики';
}

export function prefillConsultationGuest({ fullName, phone }: { fullName?: string; phone?: string }) {
  sessionStorage.setItem(
    STORAGE_KEYS.consultPrefill,
    JSON.stringify({ fullName: fullName || undefined, phone: phone || undefined }),
  );
}

export function prefillBookingFromConsultation({
  detail,
  serviceRequestId,
  fullName,
  phone,
}: {
  detail: ConsultationDetail | null;
  serviceRequestId?: string;
  fullName?: string;
  phone?: string;
}) {
  sessionStorage.setItem(
    STORAGE_KEYS.bookingPrefill,
    JSON.stringify({
      fromConsultation: true,
      serviceRequestId,
      consultationSummary: buildConsultationBookingSummary(detail),
      fullName: fullName || undefined,
      phone: phone || undefined,
    }),
  );
}
