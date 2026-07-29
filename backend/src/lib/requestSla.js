const SLA_HOURS = 4;

export function isSlaBreached(request) {
  if (!request || !['NEW', 'IN_PROGRESS'].includes(request.status)) return false;
  if (request.firstResponseAt) return false;
  const hours = (Date.now() - new Date(request.createdAt).getTime()) / 3600000;
  return hours > SLA_HOURS;
}

export function slaHoursSinceCreated(request) {
  return (Date.now() - new Date(request.createdAt).getTime()) / 3600000;
}

export { SLA_HOURS };
