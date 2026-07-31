import {
  resolveClientStatusLabel,
  resolveClientStatusTone,
  type ClientStatusTone,
} from '../../lib/clientStatusLegend';

export function ClientStatusBadge({
  status,
  className = '',
}: {
  status: string;
  className?: string;
}) {
  const tone = resolveClientStatusTone(status);
  const label = resolveClientStatusLabel(status);

  return (
    <span className={`client-status-badge is-tone-${tone} ${className}`.trim()}>{label}</span>
  );
}

export function clientProgressTone(stage: string): ClientStatusTone {
  switch (stage) {
    case 'diagnosis':
      return 'new';
    case 'request':
      return 'active';
    case 'booking':
      return 'scheduled';
    case 'done':
      return 'done';
    default:
      return 'muted';
  }
}
