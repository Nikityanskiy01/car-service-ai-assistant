/**
 * Интеграции CRM: подключения, outbox, jobs, webhook.
 * Реализация в service/*; этот модуль — публичный фасад.
 */

export {
  listConnections,
  createConnection,
  patchConnection,
  deleteConnection,
  setConnectionEnabled,
  getCapabilities,
  testConnection,
} from './service/connections.js';
export { enqueueOutboxEvent, dispatchOutbox, processPendingJobs } from './service/outbox.js';
export { listJobs, retryJob, cancelJob } from './service/jobs.js';
export { listConflicts, resolveConflict, listAuditLogs } from './service/conflicts.js';
export { handleIncomingWebhook } from './service/webhooks.js';
export { getRequestIntegrationStatus, exportRequestToConnection } from './service/requests.js';
