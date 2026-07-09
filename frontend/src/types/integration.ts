export type IntegrationProvider =
  | 'ONE_C'
  | 'AUTODEALER_DESKTOP'
  | 'AUTODEALER_WEB'
  | 'AUTODEALER_ONLINE'
  | 'BITRIX24'
  | 'AMOCRM'
  | 'YCLIENTS'
  | 'MOYSKLAD'
  | 'MEGAPLAN'
  | 'GENERIC_REST'
  | 'GENERIC_WEBHOOK'
  | 'FILE_EXCHANGE';

export type IntegrationConnectionStatus =
  | 'NOT_CONFIGURED'
  | 'REQUIRES_SETUP'
  | 'TESTING'
  | 'CONNECTED'
  | 'LIMITED'
  | 'AUTH_ERROR'
  | 'UNAVAILABLE'
  | 'PAUSED';

export type IntegrationJobStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'SUCCEEDED'
  | 'RETRYING'
  | 'FAILED'
  | 'DEAD_LETTER'
  | 'CANCELLED';

export type IntegrationCapabilities = {
  pushCustomers: boolean;
  pullCustomers: boolean;
  pushVehicles: boolean;
  pullVehicles: boolean;
  pushRequests: boolean;
  pullRequests: boolean;
  pushBookings: boolean;
  pullBookings: boolean;
  pushConsultations: boolean;
  pullStatuses: boolean;
  webhooks: boolean;
  polling: boolean;
  fileExport: boolean;
  fileImport: boolean;
  bidirectionalSync: boolean;
};

export type IntegrationConnection = {
  id: string;
  tenantId: string;
  name: string;
  provider: IntegrationProvider;
  versionLabel: string | null;
  mode: string;
  status: IntegrationConnectionStatus;
  enabled: boolean;
  capabilities: IntegrationCapabilities | null;
  config: Record<string, unknown> | null;
  lastSyncAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  credentials: Array<{ key: string; maskedValue: string }>;
};

export type IntegrationJob = {
  id: string;
  connectionId: string;
  eventType: string;
  entityType: string;
  entityId: string;
  idempotencyKey: string;
  status: IntegrationJobStatus;
  attemptCount: number;
  nextAttemptAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type IntegrationConflict = {
  id: string;
  connectionId: string;
  entityType: string;
  entityId: string;
  fieldName: string;
  localValue: string | null;
  externalValue: string | null;
  status: string;
  createdAt: string;
};

export type RequestIntegrationStatus = {
  links: Array<{
    connectionId: string;
    connectionName: string;
    provider: IntegrationProvider;
    externalEntityId: string;
    externalUrl: string | null;
    synchronizedAt: string;
  }>;
  jobs: IntegrationJob[];
};

export type ConnectionTestResult = {
  ok: boolean;
  steps: Array<{ name: string; ok: boolean; message?: string }>;
  message?: string;
};
