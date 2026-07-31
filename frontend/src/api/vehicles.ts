import { api } from './client';

export type ClientVehicle = {
  id: string;
  make: string;
  model: string;
  year?: number | null;
  vin?: string | null;
  notes?: string | null;
  source: 'manual' | 'imported' | string;
  activeCasesCount?: number;
  totalCasesCount?: number;
  createdAt: string;
  updatedAt: string;
};

export type CreateVehicleInput = {
  make: string;
  model: string;
  year?: number | null;
  vin?: string | null;
  notes?: string | null;
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

export function deleteVehicle(id: string) {
  return api<void>(`/vehicles/${id}`, { method: 'DELETE' });
}

export function formatVehicleTitle(vehicle: Pick<ClientVehicle, 'make' | 'model' | 'year'>) {
  return [vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(' ');
}
