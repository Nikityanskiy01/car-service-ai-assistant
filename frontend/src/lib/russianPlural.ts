function pluralize(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return many;
  if (last > 1 && last < 5) return few;
  if (last === 1) return one;
  return many;
}

export function formatUnreadMessagesLabel(count: number): string {
  if (count <= 0) return 'Нет новых сообщений';
  const noun = pluralize(count, 'новое сообщение', 'новых сообщения', 'новых сообщений');
  return `${count} ${noun}`;
}

export function formatActiveCasesLabel(count: number): string {
  if (count <= 0) return 'Нет активных заявок';
  const noun = pluralize(count, 'активная заявка', 'активные заявки', 'активных заявок');
  return `${count} ${noun}`;
}

export function formatTotalCasesLabel(count: number): string {
  if (count <= 0) return 'Нет обращений';
  const noun = pluralize(count, 'обращение', 'обращения', 'обращений');
  return `${count} ${noun}`;
}

export function formatVehicleCasesLabel(vehicle: {
  activeCasesCount?: number;
  totalCasesCount?: number;
}): string {
  if (vehicle.activeCasesCount && vehicle.activeCasesCount > 0) {
    return formatActiveCasesLabel(vehicle.activeCasesCount);
  }
  if (vehicle.totalCasesCount && vehicle.totalCasesCount > 0) {
    return formatTotalCasesLabel(vehicle.totalCasesCount);
  }
  return 'Нет обращений';
}
