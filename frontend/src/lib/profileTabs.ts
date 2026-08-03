export type ProfileTab = 'contacts' | 'notifications' | 'security';

export function parseProfileTab(value: string | null): ProfileTab {
  if (value === 'notifications' || value === 'security') return value;
  return 'contacts';
}
