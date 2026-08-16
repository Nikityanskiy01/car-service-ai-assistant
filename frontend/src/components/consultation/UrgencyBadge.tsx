import { AlertTriangle, Clock3, Siren, ShieldAlert } from 'lucide-react';
import { formatUrgencyLabel, urgencyHint } from '../../lib/labels';
import { HintTooltip } from '../manager/help/HintLabel';

const ICONS = {
  low: Clock3,
  medium: AlertTriangle,
  high: ShieldAlert,
  critical: Siren,
} as const;

export function UrgencyBadge({
  urgency,
}: {
  urgency?: string | null;
}) {
  if (!urgency) return null;
  const key = urgency.toLowerCase() as keyof typeof ICONS;
  const Icon = ICONS[key];
  const label = formatUrgencyLabel(key);
  if (!Icon || !label) return null;
  return (
    <HintTooltip hint={urgencyHint(key)}>
      <span className={`urgency-badge urgency-${key}`}>
        <Icon size={14} aria-hidden="true" />
        {label}
      </span>
    </HintTooltip>
  );
}
