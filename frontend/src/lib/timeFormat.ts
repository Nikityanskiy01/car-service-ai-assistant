export function formatMinutesUntil(dateIso: string) {
  const diffMin = Math.round((new Date(dateIso).getTime() - Date.now()) / 60000);
  if (diffMin < 0) return `было ${Math.abs(diffMin)} мин назад`;
  if (diffMin === 0) return 'сейчас';
  if (diffMin < 60) return `через ${diffMin} мин`;
  const hours = Math.floor(diffMin / 60);
  const mins = diffMin % 60;
  return mins ? `через ${hours} ч ${mins} мин` : `через ${hours} ч`;
}
