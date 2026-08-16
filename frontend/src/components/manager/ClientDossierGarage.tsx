import { formatMileageKm } from '../../lib/managerRequestHelpers';
import { formatDay, vehicleTitle } from '../../lib/managerClientDossier';
import type { DossierVehicle } from '../../types/dashboard';

type ClientDossierGarageProps = {
  vehicles: DossierVehicle[];
  isGuest: boolean;
};

function carView(vehicle: DossierVehicle) {
  const title = vehicleTitle(vehicle) || vehicle.licensePlate || 'Авто';
  const facts = [
    vehicle.licensePlate,
    vehicle.color,
    vehicle.currentMileageKm != null ? formatMileageKm(vehicle.currentMileageKm) : null,
  ].filter(Boolean) as string[];
  const vin = vehicle.vin?.trim() || null;
  const service = vehicle.lastServiceTitle
    ? `${vehicle.lastServiceTitle}${vehicle.lastServiceAt ? ` · ${formatDay(vehicle.lastServiceAt)}` : ''}`
    : null;
  const notes = [service, vehicle.notes?.trim()].filter(Boolean) as string[];
  return { title, facts, vin, notes };
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
          const car = carView(vehicle);
          return (
            <li key={vehicle.id || `${car.title}-${index}`} className="manager-dossier-car">
              <strong>{car.title}</strong>
              {car.facts.length ? <p>{car.facts.join(', ')}</p> : null}
              {car.vin ? <p className="manager-dossier-car-vin">{car.vin}</p> : null}
              {car.notes.length ? (
                <ul className="manager-dossier-car-notes">
                  {car.notes.map((note) => (
                    <li key={note}>{note}</li>
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
