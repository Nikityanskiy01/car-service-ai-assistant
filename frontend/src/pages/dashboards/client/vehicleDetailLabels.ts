import type { MaintenancePlan, ServiceRecordCategory } from '../../../api/serviceRecords';

export const CATEGORY_OPTIONS: Array<{ id: ServiceRecordCategory; label: string; title: string }> = [
  { id: 'oil_change', label: 'Масло', title: 'Замена масла ДВС' },
  { id: 'maintenance', label: 'ТО', title: 'Плановое ТО' },
  { id: 'brakes', label: 'Тормоза', title: 'Тормозная система' },
  { id: 'filters', label: 'Фильтры', title: 'Замена фильтров' },
  { id: 'tires', label: 'Шины', title: 'Шиномонтаж' },
  { id: 'other', label: 'Прочее', title: 'Выполненные работы' },
];

export function statusLabel(status?: string) {
  if (status === 'overdue') return 'Просрочено';
  if (status === 'soon') return 'Скоро';
  if (status === 'ok') return 'В норме';
  return 'Нет данных';
}

export function oilTitle(status?: string) {
  if (status === 'overdue') return 'Пора менять масло';
  if (status === 'soon') return 'Скоро нужна замена';
  if (status === 'ok') return 'Масло в норме';
  return 'План замены масла';
}

export function oilLead(status?: string, remainCopy?: string, intervalKm?: number, intervalMonths?: number) {
  if (status === 'overdue') {
    return remainCopy
      ? `Пробег и срок вышли: ${remainCopy}. Запишитесь — сервис подберёт время.`
      : 'Интервал замены вышел. Запишитесь на удобное время.';
  }
  if (status === 'soon') {
    return remainCopy
      ? `До замены осталось: ${remainCopy}. Лучше записаться заранее.`
      : 'Скоро подойдёт срок замены масла.';
  }
  if (status === 'ok') {
    return remainCopy
      ? `Запас: ${remainCopy}. Можно спокойно ездить.`
      : 'По текущим данным масло в порядке.';
  }
  return `Укажите прошлую замену — рассчитаем срок по регламенту ${intervalKm ?? 7500} км / ${intervalMonths ?? 6} мес.`;
}

export function formatMoney(minor?: number | null) {
  if (minor == null) return null;
  return `${Math.round(minor / 100).toLocaleString('ru-RU')} ₽`;
}

export function categoryLabel(category: string) {
  return CATEGORY_OPTIONS.find((o) => o.id === category)?.title || 'Работы';
}

export function categoryTitle(category: ServiceRecordCategory) {
  return CATEGORY_OPTIONS.find((o) => o.id === category)?.title || 'Выполненные работы';
}

export function recordsCountLabel(count: number) {
  if (!count) return 'Пока пусто';
  if (count === 1) return '1 запись';
  if (count < 5) return `${count} записи`;
  return `${count} записей`;
}

export function oilRemainCopy(plan: MaintenancePlan | null) {
  const kmLeft = plan?.plan?.kmLeft;
  const daysLeft = plan?.plan?.daysLeft;
  const parts: string[] = [];

  if (kmLeft != null) {
    if (kmLeft < 0) parts.push(`+${Math.abs(kmLeft).toLocaleString('ru-RU')} км сверх нормы`);
    else parts.push(`${kmLeft.toLocaleString('ru-RU')} км`);
  }
  if (daysLeft != null) {
    if (daysLeft < 0) parts.push(`${Math.abs(daysLeft)} дн. просрочки`);
    else parts.push(`${daysLeft} дн.`);
  }
  return parts.join(' · ');
}

export function oilProgress(plan: MaintenancePlan | null) {
  if (!plan?.plan || !plan.hasHistory) return null;
  const interval = plan.intervalKm || 7500;
  const kmLeft = plan.plan.kmLeft;
  if (kmLeft == null) return null;
  const used = interval - kmLeft;
  const ratio = Math.min(1, Math.max(0, used / interval));
  return { ratio, overdue: kmLeft < 0 };
}
