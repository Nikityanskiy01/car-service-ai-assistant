export const SLA_MINUTES = 15;
export const SLA_MS = SLA_MINUTES * 60 * 1000;
export const SLA_OVERDUE_SHORT = 'Без ответа';
export const SLA_OVERDUE_HINT = `больше ${SLA_MINUTES} мин`;
export const SLA_OVERDUE_LABEL = `${SLA_OVERDUE_SHORT} ${SLA_OVERDUE_HINT}`;

function waitMs(createdAt: string) {
  return Date.now() - new Date(createdAt).getTime();
}

export function formatWait(createdAt: string) {
  const minutes = Math.max(1, Math.floor(waitMs(createdAt) / 60000));
  if (minutes < 60) return `${minutes} мин`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} ч ${rest} мин` : `${hours} ч`;
}

export function isSlaBreached(request: {
  status: string;
  createdAt: string;
  firstResponseAt?: string | null;
  slaBreached?: boolean;
}) {
  if (request.slaBreached != null) return request.slaBreached;
  if (!['NEW', 'IN_PROGRESS'].includes(request.status)) return false;
  if (request.firstResponseAt) return false;
  return waitMs(request.createdAt) > SLA_MS;
}

export function slaLabel(request: {
  status: string;
  createdAt: string;
  firstResponseAt?: string | null;
  slaBreached?: boolean;
}) {
  if (!isSlaBreached(request)) return null;
  return `Без ответа ${formatWait(request.createdAt)}`;
}
