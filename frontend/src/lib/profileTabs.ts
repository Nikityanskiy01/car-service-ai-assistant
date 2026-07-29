export type ProfileTab = 'contacts' | 'vehicles' | 'notifications' | 'security';

export function parseProfileTab(value: string | null): ProfileTab {
  if (value === 'vehicles' || value === 'notifications' || value === 'security') return value;
  return 'contacts';
}
