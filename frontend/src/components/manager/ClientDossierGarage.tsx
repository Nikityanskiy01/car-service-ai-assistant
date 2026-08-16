import { formatMileageKm } from '../../lib/managerRequestHelpers';
import { formatDay, vehicleTitle } from '../../lib/managerClientDossier';
import type { DossierVehicle } from '../../types/dashboard';

type ClientDossierGarageProps = {
  vehicles: DossierVehicle[];
  isGuest: boolean;
};

function chipsOf(vehicle: DossierVehicle) {
  const mileage = vehicle.currentMileageKm != null ? formatMileageKm(vehicle.currentMileageKm) : null;
  const lastService = vehicle.lastServiceTitle
    ? `${vehicle.lastServiceTitle}${vehicle.lastServiceAt ? ` · ${formatDay(vehicle.lastServiceAt)}` : ''}`
    : null;
  return [
    vehicle.licensePlate ? { label: 'Номер', value: vehicle.licensePlate } : null,
    vehicle.vin ? { label: 'VIN', value: vehicle.vin } : null,
    vehicle.color ? { label: 'Цвет', value: vehicle.color } : null,
    mileage ? { label: 'Пробег', value: mileage } : null,
    lastService ? { label: 'ТО', value: lastService } : null,
    vehicle.notes ? { label: 'Заметка', value: vehicle.notes } : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>;
}

export function ClientDossierGarage({ vehicles, isGuest }: ClientDossierGarageProps) {
  if (!vehicles.length) {
    return (
      <section className="manager-dossier-section" aria-labelledby="manager-dossier-garage">
        <h3 id="manager-dossier-garage">Гараж</h3>
        <p className="manager-dossier-empty">
          {isGuest
            ? 'Марка, номер и VIN появятся из заявки, если гость их указал.'
            : 'В гараже пусто — авто подтянется из заявки или записи.'}
        </p>
      </section>
    );
  }

  return (
    <section className="manager-dossier-section" aria-labelledby="manager-dossier-garage">
      <h3 id="manager-dossier-garage">Гараж</h3>
      <ul className="manager-dossier-garage">
        {vehicles.map((vehicle, index) => {
          const title = vehicleTitle(vehicle) || vehicle.licensePlate || 'Авто';
          const chips = chipsOf(vehicle);
          return (
            <li key={vehicle.id || `${title}-${index}`} className="manager-dossier-car">
              <strong>{title}</strong>
              {chips.length ? (
                <ul className="manager-dossier-car-chips">
                  {chips.map((chip) => (
                    <li key={`${chip.label}-${chip.value}`}>
                      <span>{chip.label}</span>
                      {chip.value}
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
