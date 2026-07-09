import { INTEGRATION_STATUS_LABELS } from '../../lib/labels';
import type { IntegrationConnectionStatus } from '../../types/integration';

export function IntegrationStatusBadge({ status }: { status: IntegrationConnectionStatus | string }) {
  const label = INTEGRATION_STATUS_LABELS[status as IntegrationConnectionStatus] || status;
  const className = `integration-status-badge status-${String(status).toLowerCase().replace(/_/g, '-')}`;
  return <span className={className}>{label}</span>;
}
