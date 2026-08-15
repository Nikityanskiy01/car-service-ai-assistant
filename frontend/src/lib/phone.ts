export function digitsOnly(raw: string) {
  return String(raw || '').replace(/\D/g, '');
}

export function formatPhoneDisplay(raw: string | null | undefined) {
  const d = digitsOnly(raw || '');
  if (!d) return '—';
  if (d.length === 11 && d.startsWith('7')) {
    return `+7 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7, 9)}-${d.slice(9)}`;
  }
  return `+${d}`;
}

export function maskEmail(email: string) {
  const [local, domain] = String(email || '').split('@');
  if (!domain) return '***';
  if (local.length <= 2) return `${local[0] || '*'}*@${domain}`;
  return `${local[0]}${'*'.repeat(Math.min(local.length - 2, 4))}${local.slice(-1)}@${domain}`;
}
