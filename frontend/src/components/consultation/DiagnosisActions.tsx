import { CalendarPlus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { prefillConsultationBooking } from '../../features/consultations/bookingPrefill';
import type { ConsultationDetail } from '../../types/consultation';

export function DiagnosisActions({ detail }: { detail: ConsultationDetail | null }) {
  const ready =
    detail?.status === 'COMPLETED' ||
    detail?.flowState?.stage === 'COMPLETED' ||
    Boolean(detail?.recommendations?.length || detail?.diagnosis?.summary);

  if (!ready) return null;

  return (
    <div className="diagnosis-actions">
      <Link
        to="/booking"
        className="btn btn-secondary diagnosis-booking-btn"
        onClick={() => prefillConsultationBooking(detail)}
      >
        <CalendarPlus size={16} aria-hidden="true" />
        Записаться на диагностику
      </Link>
    </div>
  );
}
