import { AlertTriangle, Clock3, Siren, ShieldAlert } from 'lucide-react';

const map = {
  low: { label: 'Низкая', icon: Clock3 },
  medium: { label: 'Средняя', icon: AlertTriangle },
  high: { label: 'Высокая', icon: ShieldAlert },
  critical: { label: 'Критическая', icon: Siren },
};

export function UrgencyBadge({ urgency }: { urgency?: string | null }) {
  const key = (urgency || 'low').toLowerCase() as keyof typeof map;
  const entry = map[key] || map.low;
  const Icon = entry.icon;
  return (
    <span className={`urgency-badge urgency-${key}`}>
      <Icon size={14} />
      {entry.label}
    </span>
  );
}
