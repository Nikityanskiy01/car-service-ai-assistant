export const SLA_MINUTES = 15;
export const SLA_MS = SLA_MINUTES * 60 * 1000;

export function waitMsSinceCreated(request) {
  return Date.now() - new Date(request.createdAt).getTime();
}

export function formatWaitSinceCreated(request) {
  const minutes = Math.max(1, Math.floor(waitMsSinceCreated(request) / 60000));
  if (minutes < 60) return `${minutes} мин`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} ч ${rest} мин` : `${hours} ч`;
}

export function isSlaBreached(request) {
  if (!request || !['NEW', 'IN_PROGRESS'].includes(request.status)) return false;
  if (request.firstResponseAt) return false;
  return waitMsSinceCreated(request) > SLA_MS;
}
