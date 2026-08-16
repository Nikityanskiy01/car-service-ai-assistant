export const INTEGRATION_PROVIDERS = [
  'ONE_C',
  'AUTODEALER_DESKTOP',
  'AUTODEALER_WEB',
  'AUTODEALER_ONLINE',
  'BITRIX24',
  'AMOCRM',
  'YCLIENTS',
  'MOYSKLAD',
  'MEGAPLAN',
  'GENERIC_REST',
  'GENERIC_WEBHOOK',
  'FILE_EXCHANGE',
];

export const INTEGRATION_CONNECTION_STATUS = [
  'NOT_CONFIGURED',
  'REQUIRES_SETUP',
  'TESTING',
  'CONNECTED',
  'LIMITED',
  'AUTH_ERROR',
  'UNAVAILABLE',
  'PAUSED',
];

export const INTEGRATION_JOB_STATUS = [
  'PENDING',
  'PROCESSING',
  'SUCCEEDED',
  'RETRYING',
  'FAILED',
  'DEAD_LETTER',
  'CANCELLED',
];

export const DEFAULT_CAPABILITIES = {
  pushCustomers: false,
  pullCustomers: false,
  pushVehicles: false,
  pullVehicles: false,
  pushRequests: false,
  pullRequests: false,
  pushBookings: false,
  pullBookings: false,
  pushConsultations: false,
  pullStatuses: false,
  webhooks: false,
  polling: false,
  fileExport: false,
  fileImport: false,
  bidirectionalSync: false,
};
