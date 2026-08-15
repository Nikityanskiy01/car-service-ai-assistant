import type { ServiceRequestStatus } from '../types/serviceRequest';

export const QUEUE_STATUSES: ServiceRequestStatus[] = [
  'NEW',
  'IN_PROGRESS',
  'SCHEDULED',
  'COMPLETED',
  'CANCELLED',
];
