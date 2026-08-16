import type { ClientVehicle } from '@prisma/client';

export type VehicleIdentity = {
  make?: string | null;
  model?: string | null;
  year?: number | null;
};

export type VehicleWriteInput = {
  make?: string | null;
  model?: string | null;
  year?: number | string | null;
  vin?: string | null;
  notes?: string | null;
  licensePlate?: string | null;
  color?: string | null;
  currentMileageKm?: number | string | null;
};

export type VehiclePhotoInput = {
  mimeType?: string;
  contentBase64?: string;
};

export type PublicVehicle = {
  id: string;
  make: string;
  model: string;
  year: number | null;
  vin: string | null;
  notes: string | null;
  source: string;
  currentMileageKm: number | null;
  photoUrl: string | null;
  licensePlate: string | null;
  color: string | null;
  createdAt: string;
  updatedAt: string;
};

export type VehicleLatestService = {
  lastServiceAt: string;
  lastServiceTitle: string;
  lastServiceCategory: string;
};

export type VehicleCaseCount = {
  active: number;
  total: number;
};

export type PublicVehicleWithStats = PublicVehicle & {
  activeCasesCount: number;
  totalCasesCount: number;
  lastServiceAt: string | null;
  lastServiceTitle: string | null;
  lastServiceCategory: string | null;
};

export type VehicleRow = ClientVehicle;
