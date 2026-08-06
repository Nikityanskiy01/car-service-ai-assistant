import { api } from './client';

export type ClientVehicle = {
  id: string;
  make: string;
  model: string;
  year?: number | null;
  vin?: string | null;
  notes?: string | null;
  source: 'manual' | 'imported' | string;
  currentMileageKm?: number | null;
  photoUrl?: string | null;
  licensePlate?: string | null;
  color?: string | null;
  activeCasesCount?: number;
  totalCasesCount?: number;
  lastServiceAt?: string | null;
  lastServiceTitle?: string | null;
  lastServiceCategory?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateVehicleInput = {
  make: string;
  model: string;
  year?: number | null;
  vin?: string | null;
  notes?: string | null;
  licensePlate?: string | null;
  color?: string | null;
};

export type UpdateVehicleInput = {
  currentMileageKm?: number | null;
  vin?: string | null;
  notes?: string | null;
  licensePlate?: string | null;
  color?: string | null;
};

export function listVehicles() {
  return api<ClientVehicle[]>('/vehicles');
}

export function getVehicle(id: string) {
  return api<ClientVehicle>(`/vehicles/${id}`);
}

export function createVehicle(data: CreateVehicleInput) {
  return api<ClientVehicle>('/vehicles', { method: 'POST', body: data });
}

export function updateVehicle(id: string, data: UpdateVehicleInput) {
  return api<ClientVehicle>(`/vehicles/${id}`, { method: 'PATCH', body: data });
}

export function deleteVehicle(id: string) {
  return api<void>(`/vehicles/${id}`, { method: 'DELETE' });
}

export function uploadVehiclePhoto(
  id: string,
  body: { mimeType: string; contentBase64: string },
) {
  return api<ClientVehicle>(`/vehicles/${id}/photo`, { method: 'POST', body });
}

export function removeVehiclePhoto(id: string) {
  return api<ClientVehicle>(`/vehicles/${id}/photo`, { method: 'DELETE' });
}

export function vehiclePhotoSrc(
  vehicle: Pick<ClientVehicle, 'id' | 'photoUrl' | 'updatedAt'>,
): string | null {
  if (!vehicle.photoUrl) return null;
  const stamp = vehicle.updatedAt ? `?v=${encodeURIComponent(vehicle.updatedAt)}` : '';
  return `/api/vehicles/${encodeURIComponent(vehicle.id)}/photo${stamp}`;
}

export function formatVehicleTitle(vehicle: Pick<ClientVehicle, 'make' | 'model' | 'year'>) {
  const make = vehicle.make?.trim() ?? '';
  const model = vehicle.model?.trim() ?? '';
  const name = joinMakeModel(make, model);
  return [name, vehicle.year].filter(Boolean).join(' ');
}

/** Avoid titles like "BMW бмв" when import duplicated brand into model. */
function joinMakeModel(make: string, model: string): string {
  if (!make) return model;
  if (!model) return make;

  const makeL = make.toLocaleLowerCase('ru-RU');
  const modelL = model.toLocaleLowerCase('ru-RU');
  if (makeL === modelL) return make;
  if (modelL.startsWith(`${makeL} `)) return model;
  if (makeL.startsWith(`${modelL} `) || (makeL.startsWith(modelL) && model.length >= 3 && make.length > model.length)) {
    return make;
  }

  // Latin brand + short non-Latin alphabetic model (BMW + бмв), keep models like "6мв"
  const makeIsLatinBrand = /^[A-Za-z0-9][A-Za-z0-9 .-]{0,20}$/.test(make) && /[A-Za-z]/.test(make);
  const modelIsShortOtherScript =
    !/\s/.test(model) &&
    model.length <= 5 &&
    !/[A-Za-z0-9]/.test(model);
  if (makeIsLatinBrand && modelIsShortOtherScript) return make;

  return `${make} ${model}`;
}

export function vehiclePlaceholderTone(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash % 6;
}
