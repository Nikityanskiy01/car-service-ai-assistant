import { api } from './client';

export type ServiceRecordCategory =
  | 'oil_change'
  | 'maintenance'
  | 'brakes'
  | 'filters'
  | 'tires'
  | 'other';

export type ServiceRecord = {
  id: string;
  vehicleId: string;
  clientId: string;
  performedAt: string;
  mileageKm?: number | null;
  title: string;
  category: ServiceRecordCategory | string;
  worksDone?: string | null;
  workOrderNumber?: string | null;
  amountMinor?: number | null;
  source: string;
  serviceRequestId?: string | null;
  consultationFeedbackId?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MaintenancePlan = {
  vehicleId: string;
  currentMileageKm?: number | null;
  hasHistory: boolean;
  intervalKm: number;
  intervalMonths: number;
  status: 'ok' | 'soon' | 'overdue' | 'unknown' | string;
  message?: string | null;
  lastRecord?: {
    performedAt: string;
    mileageKm?: number | null;
    title?: string;
  } | null;
  plan?: {
    nextDueAt: string;
    nextDueMileage?: number | null;
    daysLeft?: number;
    kmLeft?: number | null;
    status: string;
  } | null;
};

export type MaintenanceAlert = MaintenancePlan & {
  make: string;
  model: string;
  year?: number | null;
};

export type CreateServiceRecordInput = {
  title?: string;
  worksDone?: string | null;
  category?: ServiceRecordCategory;
  performedAt?: string | null;
  mileageKm?: number | null;
  amountMinor?: number | null;
  workOrderNumber?: string | null;
};

export function listServiceRecords(vehicleId: string) {
  return api<ServiceRecord[]>(`/vehicles/${vehicleId}/service-records`);
}

export function createServiceRecord(vehicleId: string, body: CreateServiceRecordInput) {
  return api<ServiceRecord>(`/vehicles/${vehicleId}/service-records`, {
    method: 'POST',
    body,
  });
}

export function deleteServiceRecord(recordId: string) {
  return api<void>(`/service-records/${recordId}`, { method: 'DELETE' });
}

export function getMaintenancePlan(vehicleId: string) {
  return api<MaintenancePlan>(`/vehicles/${vehicleId}/maintenance-plan`);
}

export function listMaintenanceAlerts() {
  return api<MaintenanceAlert[]>('/maintenance-alerts');
}
