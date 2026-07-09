import { ROLE_LABELS } from '../../lib/labels';

export function RoleBadge({ role }: { role: string }) {
  const label = ROLE_LABELS[role] || role;
  return <span className={`role-badge role-${role.toLowerCase()}`}>{label}</span>;
}
