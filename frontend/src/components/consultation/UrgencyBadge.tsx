import { AlertTriangle, Clock3, Siren, ShieldAlert } from 'lucide-react';

const map = {
  low: { label: 'низкая', icon: Clock3 },
  medium: { label: 'средняя', icon: AlertTriangle },
  high: { label: 'высокая', icon: ShieldAlert },
  critical: { label: 'критическая', icon: Siren },
};

export function UrgencyBadge({
  urgency,
  labeled = false,
}: {
  urgency?: string | null;
  labeled?: boolean;
}) {
  if (!urgency) return null;
  const key = urgency.toLowerCase() as keyof typeof map;
  const entry = map[key];
  if (!entry) return null;
  const Icon = entry.icon;
  const text = labeled ? `Срочность: ${entry.label}` : entry.label.replace(/^./, (ch) => ch.toUpperCase());
  return (
    <span className={`urgency-badge urgency-${key}`}>
      <Icon size={14} aria-hidden="true" />
      {text}
    </span>
  );
}
