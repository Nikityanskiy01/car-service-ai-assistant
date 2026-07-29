import { slaLabel } from '../../lib/requestSla';

export function SlaBadge({
  request,
}: {
  request: {
    status: string;
    createdAt: string;
    firstResponseAt?: string | null;
    slaBreached?: boolean;
  };
}) {
  const label = slaLabel(request);
  if (!label) return null;
  return (
    <span className="sla-badge" title="Превышено время ожидания ответа">
      {label}
    </span>
  );
}
