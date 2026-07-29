export const SLA_HOURS = 4;

export function isSlaBreached(request: {
  status: string;
  createdAt: string;
  firstResponseAt?: string | null;
  slaBreached?: boolean;
}) {
  if (request.slaBreached != null) return request.slaBreached;
  if (!['NEW', 'IN_PROGRESS'].includes(request.status)) return false;
  if (request.firstResponseAt) return false;
  const hours = (Date.now() - new Date(request.createdAt).getTime()) / 3600000;
  return hours > SLA_HOURS;
}

export function slaLabel(request: {
  status: string;
  createdAt: string;
  firstResponseAt?: string | null;
  slaBreached?: boolean;
}) {
  if (!isSlaBreached(request)) return null;
  const hours = Math.floor((Date.now() - new Date(request.createdAt).getTime()) / 3600000);
  return `Без ответа ${hours} ч`;
}
