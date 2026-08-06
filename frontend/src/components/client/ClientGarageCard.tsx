import { ArrowUpRight, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatVehicleTitle, type ClientVehicle } from '../../api/vehicles';
import {
  formatActiveCasesLabel,
  formatTotalCasesLabel,
} from '../../lib/russianPlural';
import { VehiclePhotoMedia } from './VehiclePhotoMedia';

type GarageStatusTone = 'active' | 'history' | 'idle';

function resolveGarageStatus(vehicle: ClientVehicle): { label: string; tone: GarageStatusTone } {
  if (vehicle.activeCasesCount && vehicle.activeCasesCount > 0) {
    return {
      label: formatActiveCasesLabel(vehicle.activeCasesCount),
      tone: 'active',
    };
  }
  if (vehicle.totalCasesCount && vehicle.totalCasesCount > 0) {
    return {
      label: formatTotalCasesLabel(vehicle.totalCasesCount),
      tone: 'history',
    };
  }
  return { label: 'Нет обращений', tone: 'idle' };
}

export function ClientGarageCard({ vehicle }: { vehicle: ClientVehicle }) {
  const title = formatVehicleTitle(vehicle);
  const status = resolveGarageStatus(vehicle);
  const mileage =
    vehicle.currentMileageKm != null
      ? `${vehicle.currentMileageKm.toLocaleString('ru-RU')} км`
      : null;

  return (
    <Link
      to={`/dashboard/client/vehicles/${encodeURIComponent(vehicle.id)}`}
      className="client-garage-card"
      aria-label={`${title}. ${status.label}`}
    >
      <div className="client-garage-card-media">
        <VehiclePhotoMedia vehicle={vehicle} size="sm" />
        <ArrowUpRight size={15} className="client-garage-card-arrow" aria-hidden />
      </div>
      <div className="client-garage-card-body">
        <strong>{title}</strong>
        <div className="client-garage-card-meta">
          {vehicle.licensePlate ? (
            <span className="garage-plate is-compact">{vehicle.licensePlate}</span>
          ) : mileage ? (
            <span className="client-garage-card-mileage">{mileage}</span>
          ) : null}
          <span className={`client-garage-card-status is-${status.tone}`}>{status.label}</span>
        </div>
      </div>
    </Link>
  );
}

export function ClientGarageAddCard({ to }: { to: string }) {
  return (
    <Link to={to} className="client-garage-card client-garage-card-add">
      <span className="client-garage-card-add-icon" aria-hidden>
        <Plus size={22} strokeWidth={2.2} />
      </span>
      <div className="client-garage-card-body">
        <strong>Добавить авто</strong>
        <span>Ещё один автомобиль</span>
      </div>
    </Link>
  );
}
