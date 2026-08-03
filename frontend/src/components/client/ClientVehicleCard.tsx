import { Car, ChevronRight, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatVehicleTitle, type ClientVehicle } from '../../api/vehicles';
import { formatVehicleCasesLabel } from '../../lib/russianPlural';
import { Button } from '../ui/Button';

export function ClientVehicleCard({
  vehicle,
  onDelete,
}: {
  vehicle: ClientVehicle;
  onDelete: (id: string) => void;
}) {
  const title = formatVehicleTitle(vehicle);
  const casesLabel = formatVehicleCasesLabel(vehicle);
  const hasActive = Boolean(vehicle.activeCasesCount && vehicle.activeCasesCount > 0);
  const casesHref = `/dashboard/client/cases?tab=active&vehicleId=${encodeURIComponent(vehicle.id)}`;

  return (
    <div className="client-vehicle-row">
      <Link
        to={casesHref}
        className="case-card is-link"
        data-status-tone={hasActive ? 'active' : 'muted'}
        aria-label={`${title}. ${casesLabel}`}
      >
        <span className="case-card-icon" aria-hidden>
          <Car size={18} />
        </span>
        <div className="case-card-body">
          <strong className="case-card-title">{title}</strong>
          <div className="case-card-meta">
            <span className="case-card-status">{casesLabel}</span>
            {vehicle.vin ? <span className="client-vehicle-vin">VIN {vehicle.vin}</span> : null}
          </div>
        </div>
        <ChevronRight size={18} className="case-card-chevron" aria-hidden />
      </Link>
      <Button
        type="button"
        variant="ghost"
        className="btn-icon-danger client-vehicle-row-delete"
        aria-label={`Удалить ${title}`}
        onClick={() => onDelete(vehicle.id)}
      >
        <Trash2 size={16} aria-hidden />
      </Button>
    </div>
  );
}
