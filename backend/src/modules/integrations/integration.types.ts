export type AdapterConfig = {
  baseUrl?: string;
  webhookUrl?: string;
  token?: string;
  apiToken?: string;
  webhookToken?: string;
  healthPath?: string;
  authType?: string;
  username?: string;
  password?: string;
  login?: string;
  timeoutMs?: number;
  requestEndpoint?: string;
  companyId?: string;
  subdomain?: string;
  format?: string;
};

export type AdapterTestResult = {
  ok: boolean;
  httpStatus: number | null;
  latencyMs: number;
  message: string;
  details?: unknown;
};

export type PushContext = {
  config?: AdapterConfig;
  idempotencyKey?: string;
};

export type IntegrationRequestPayload = {
  internalId?: string;
  number?: string;
  internalStatus?: string;
  urgency?: string;
  confidence?: number;
  estimatedPriceFrom?: number;
  symptoms?: string;
  consultationSummary?: string;
  customer?: { fullName?: string; phone?: string; email?: string };
  vehicle?: { make?: string; model?: string; year?: number; vin?: string };
};

export type PushResult = {
  externalEntityType: string;
  externalEntityId: string;
  externalUrl: string | null;
};

export type IntegrationAdapter = {
  provider: string;
  getCapabilities(): Promise<Record<string, boolean>>;
  validateConfiguration(config: AdapterConfig): Promise<{ ok: boolean; errors: string[] }>;
  testConnection(config: AdapterConfig): Promise<AdapterTestResult>;
  pushServiceRequest(request: IntegrationRequestPayload, context: PushContext): Promise<PushResult>;
};
