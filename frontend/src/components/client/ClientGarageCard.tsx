import { ArrowUpRight, Car, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatVehicleTitle, type ClientVehicle } from '../../api/vehicles';
import {
  formatActiveCasesLabel,
  formatTotalCasesLabel,
} from '../../lib/russianPlural';

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

  return (
    <Link
      to={`/dashboard/client/cases?tab=active&vehicleId=${encodeURIComponent(vehicle.id)}`}
      className="client-garage-card"
      aria-label={`${title}. ${status.label}`}
    >
      <div className="client-garage-card-top">
        <span className="client-garage-card-icon" aria-hidden>
          <Car size={20} strokeWidth={2.1} />
        </span>
        <ArrowUpRight size={15} className="client-garage-card-arrow" aria-hidden />
      </div>
      <div className="client-garage-card-body">
        <strong>{title}</strong>
        <span className={`client-garage-card-status is-${status.tone}`}>{status.label}</span>
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
