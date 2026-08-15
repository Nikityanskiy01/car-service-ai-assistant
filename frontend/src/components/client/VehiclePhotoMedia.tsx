import { Car } from 'lucide-react';
import {
  formatVehicleTitle,
  vehiclePhotoSrc,
  vehiclePlaceholderTone,
  type ClientVehicle,
} from '../../api/vehicles';

type VehiclePhotoMediaProps = {
  vehicle: Pick<
    ClientVehicle,
    'id' | 'make' | 'model' | 'year' | 'photoUrl' | 'updatedAt' | 'color'
  >;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'banner';
  showLabel?: boolean;
};

export function VehiclePhotoMedia({
  vehicle,
  className = '',
  size = 'md',
  showLabel = false,
}: VehiclePhotoMediaProps) {
  const src = vehiclePhotoSrc(vehicle);
  const title = formatVehicleTitle(vehicle);
  const tone = vehiclePlaceholderTone(`${vehicle.make}|${vehicle.model}|${vehicle.id}`);
  const initials = [vehicle.make, vehicle.model]
    .map((part) => part?.trim()?.[0])
    .filter(Boolean)
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const carSize = size === 'banner' || size === 'lg' ? 56 : size === 'sm' ? 28 : 40;

  return (
    <div
      className={`vehicle-photo-media is-${size} tone-${tone}${className ? ` ${className}` : ''}`}
      data-has-photo={src ? 'true' : 'false'}
      aria-hidden={!showLabel}
    >
      {src ? (
        <img src={src} alt={showLabel ? title : ''} className="vehicle-photo-media-img" />
      ) : (
        <div className="vehicle-photo-media-placeholder">
          <span className="vehicle-photo-media-glow" />
          <span className="vehicle-photo-media-silhouette" aria-hidden>
            <Car size={carSize} strokeWidth={1.5} />
          </span>
          <span className="vehicle-photo-media-initials">{initials || 'АВ'}</span>
          {vehicle.color && size !== 'banner' ? (
            <span className="vehicle-photo-media-color">{vehicle.color}</span>
          ) : null}
        </div>
      )}
    </div>
  );
}
