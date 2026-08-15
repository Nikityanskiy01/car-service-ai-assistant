import {
  CalendarPlus,
  ChevronRight,
  Droplets,
  Gauge,
  Hash,
  History,
  Trash2,
  Wrench,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatVehicleTitle, type ClientVehicle } from '../../api/vehicles';
import { bookingPath } from '../../lib/bookingPath';
import { formatVehicleCasesLabel } from '../../lib/russianPlural';
import { Button } from '../ui/Button';
import { VehiclePhotoMedia } from './VehiclePhotoMedia';

export function ClientVehicleCard({
  vehicle,
  onDelete,
  oilStatus,
}: {
  vehicle: ClientVehicle;
  onDelete: (id: string) => void;
  oilStatus?: 'ok' | 'soon' | 'overdue' | 'unknown' | string | null;
}) {
  const title = formatVehicleTitle(vehicle);
  const casesLabel = formatVehicleCasesLabel(vehicle);
  const hasActive = Boolean(vehicle.activeCasesCount && vehicle.activeCasesCount > 0);
  const detailHref = `/dashboard/client/vehicles/${encodeURIComponent(vehicle.id)}`;
  const bookingHref = bookingPath(vehicle.id);
  const vinShort = vehicle.vin
    ? `${vehicle.vin.slice(0, 4)}…${vehicle.vin.slice(-4)}`
    : null;

  return (
    <article
      className={`garage-vehicle-card${hasActive ? ' has-active' : ''}`}
      data-oil={oilStatus || 'unknown'}
    >
      <Link to={detailHref} className="garage-vehicle-card-main" aria-label={`${title}. ${casesLabel}`}>
        <div className="garage-vehicle-card-media">
          <VehiclePhotoMedia vehicle={vehicle} size="md" />
          {hasActive ? (
            <span className="garage-vehicle-card-badge is-active">{casesLabel}</span>
          ) : null}
          {oilStatus === 'soon' || oilStatus === 'overdue' ? (
            <span className={`garage-vehicle-card-badge is-oil is-${oilStatus}`}>
              <Droplets size={12} aria-hidden />
              {oilStatus === 'overdue' ? 'Масло просрочено' : 'Скоро масло'}
            </span>
          ) : null}
        </div>

        <div className="garage-vehicle-card-body">
          <header className="garage-vehicle-card-head">
            <div className="garage-vehicle-card-titles">
              <strong className="garage-vehicle-card-title">{title}</strong>
              <div className="garage-vehicle-card-sub">
                {vehicle.licensePlate ? (
                  <span className="garage-plate">{vehicle.licensePlate}</span>
                ) : null}
                {vehicle.color ? <span>{vehicle.color}</span> : null}
                {!vehicle.licensePlate && !vehicle.color && vehicle.year ? (
                  <span>{vehicle.year} г.</span>
                ) : null}
                {!hasActive ? <span className="garage-vehicle-card-cases">{casesLabel}</span> : null}
              </div>
            </div>
            <ChevronRight size={18} className="garage-vehicle-card-chevron" aria-hidden />
          </header>

          <dl className="garage-vehicle-card-stats">
            <div>
              <dt>
                <Gauge size={13} aria-hidden />
                Пробег
              </dt>
              <dd>
                {vehicle.currentMileageKm != null
                  ? `${vehicle.currentMileageKm.toLocaleString('ru-RU')} км`
                  : 'не указан'}
              </dd>
            </div>
            <div>
              <dt>
                <Wrench size={13} aria-hidden />
                Сервис
              </dt>
              <dd>
                {vehicle.lastServiceAt
                  ? new Date(vehicle.lastServiceAt).toLocaleDateString('ru-RU')
                  : 'нет записей'}
              </dd>
            </div>
            <div>
              <dt>
                <Hash size={13} aria-hidden />
                VIN
              </dt>
              <dd className={vinShort ? 'is-mono' : undefined}>{vinShort || 'не указан'}</dd>
            </div>
          </dl>

          {vehicle.lastServiceTitle ? (
            <p className="garage-vehicle-card-last">
              Последнее: <span>{vehicle.lastServiceTitle}</span>
            </p>
          ) : null}
        </div>
      </Link>

      <footer className="garage-vehicle-card-actions">
        <Link
          to={detailHref}
          className="btn btn-secondary btn-sm"
          aria-label={`История обслуживания ${title}`}
        >
          <History size={14} aria-hidden />
          История
        </Link>
        <Link to={bookingHref} className="btn btn-secondary btn-sm" aria-label={`Записаться на ${title}`}>
          <CalendarPlus size={14} aria-hidden />
          Запись
        </Link>
        <Button
          type="button"
          variant="ghost"
          className="btn-icon-danger garage-vehicle-card-delete"
          aria-label={`Удалить ${title}`}
          onClick={() => onDelete(vehicle.id)}
        >
          <Trash2 size={16} aria-hidden />
        </Button>
      </footer>
    </article>
  );
}
