import { CalendarPlus } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  prefillConsultationBooking,
  prefillOilChangeBooking,
} from '../../features/consultations/bookingPrefill';
import type { ConsultationDetail } from '../../types/consultation';

export function DiagnosisActions({
  detail,
  onCreateRequest,
}: {
  detail: ConsultationDetail | null;
  onCreateRequest?: () => void;
}) {
  const maintenanceCta = detail?.flowState?.maintenance_cta;
  const isServiceHistory = detail?.flowState?.stage === 'SERVICE_HISTORY' || Boolean(maintenanceCta);

  const ready =
    isServiceHistory ||
    detail?.status === 'COMPLETED' ||
    detail?.flowState?.stage === 'COMPLETED' ||
    detail?.flowState?.stage === 'MANUAL_REVIEW_REQUIRED' ||
    Boolean(detail?.recommendations?.length || detail?.diagnosis?.summary);

  if (!ready) return null;

  if (isServiceHistory && maintenanceCta?.action === 'book') {
    return (
      <div className="diagnosis-actions">
        <Link
          to="/booking"
          className="btn btn-primary diagnosis-booking-btn"
          onClick={() => prefillOilChangeBooking(detail)}
        >
          <CalendarPlus size={16} aria-hidden="true" />
          Записаться на замену масла
        </Link>
        {maintenanceCta.vehicleId ? (
          <Link
            to={`/dashboard/client/vehicles/${maintenanceCta.vehicleId}`}
            className="btn btn-secondary"
          >
            История обслуживания
          </Link>
        ) : null}
      </div>
    );
  }

  if (isServiceHistory && maintenanceCta?.action === 'add_record' && maintenanceCta.vehicleId) {
    return (
      <div className="diagnosis-actions">
        <Link
          to={`/dashboard/client/vehicles/${maintenanceCta.vehicleId}`}
          className="btn btn-primary"
        >
          Добавить замену масла в книжку
        </Link>
      </div>
    );
  }

  return (
    <div className="diagnosis-actions">
      {onCreateRequest ? (
        <button type="button" className="btn btn-primary diagnosis-request-btn" onClick={onCreateRequest}>
          Передать в сервис
        </button>
      ) : null}
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
