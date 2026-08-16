/**
 * Ответы ИИ по персональной истории обслуживания (замена масла и т.п.).
 */
import { buildOilMaintenancePlan } from '../lib/maintenanceIntervals.js';
import * as serviceRecordsService from '../modules/serviceRecords/serviceRecords.service.js';

const HISTORY_MARKERS = [
  'когда менял масло',
  'когда меняли масло',
  'когда я менял масло',
  'когда менял масла',
  'когда последний раз масло',
  'когда последнее масло',
  'когда было то',
  'когда последнее то',
  'когда менял масло в последний',
  'дата замены масла',
  'пробег замены масла',
  'пора ли менять масло',
  'нужно ли менять масло',
  'когда менять масло',
  'когда менять масло снова',
  'следующая замена масла',
];

/**
 * @param message
 */
export function isServiceHistoryQuestion(message) {
  const low = String(message || '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (!low) return false;
  if (HISTORY_MARKERS.some((m) => low.includes(m))) return true;

  const asksWhen =
    low.includes('когда') ||
    low.includes('пора') ||
    low.includes('следующ') ||
    low.includes('последн');
  const aboutOil = low.includes('масл');
  const aboutTo = /(^|[\s,.;:!?])то($|[\s,.;:!?])/i.test(low) || low.includes('техобслуж');

  return asksWhen && (aboutOil || aboutTo);
}

function formatRuDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('ru-RU');
}

function vehicleTitle(vehicle) {
  if (!vehicle) return 'автомобиль';
  return [vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(' ') || 'автомобиль';
}

/**
 * @param opts
 */
export async function answerServiceHistoryQuestion({ clientId, vehicleId, message }: any) {
  if (!isServiceHistoryQuestion(message)) return null;

  if (!clientId) {
    return {
      handled: true,
      assistant_message:
        'Чтобы подсказать дату и пробег последней замены масла, войдите в кабинет — я посмотрю вашу сервисную книжку. Либо добавьте запись в гараже после входа.',
      maintenance_cta: null,
      stage: 'SERVICE_HISTORY',
    };
  }

  const lookup = await serviceRecordsService.findOilHistoryForLookup({ clientId, vehicleId });
  if (!lookup?.vehicle) {
    return {
      handled: true,
      assistant_message:
        'В гараже пока нет автомобиля. Добавьте машину в кабинете и внесите дату/пробег последней замены масла — после этого я смогу подсказать следующий срок.',
      maintenance_cta: null,
      stage: 'SERVICE_HISTORY',
    };
  }

  const { vehicle, plan } = lookup;
  const title = vehicleTitle(vehicle);

  if (!plan?.hasHistory) {
    return {
      handled: true,
      assistant_message: `По ${title} в сервисной книжке ещё нет замены масла. Добавьте прошлую замену в гараже (дата и пробег) — рассчитаю следующую по правилу 7500 км или 6 месяцев.`,
      maintenance_cta: {
        vehicleId: vehicle.id,
        action: 'add_record',
        category: 'oil_change',
      },
      stage: 'SERVICE_HISTORY',
    };
  }

  const lastDate = formatRuDate(plan.lastRecord.performedAt);
  const lastKm =
    plan.lastRecord.mileageKm != null
      ? `${plan.lastRecord.mileageKm.toLocaleString('ru-RU')} км`
      : null;
  const nextDate = formatRuDate(plan.plan?.nextDueAt);
  const nextKm =
    plan.plan?.nextDueMileage != null
      ? `${plan.plan.nextDueMileage.toLocaleString('ru-RU')} км`
      : null;

  let statusLine = '';
  if (plan.status === 'overdue') statusLine = ' Срок уже подошёл — лучше записаться.';
  else if (plan.status === 'soon') statusLine = ' Скоро пора менять масло.';
  else statusLine = ' Пока в запасе.';

  const lastPart = lastKm
    ? `Последняя замена масла на ${title}: ${lastDate} при пробеге ${lastKm}.`
    : `Последняя замена масла на ${title}: ${lastDate}.`;
  const nextPart =
    nextDate || nextKm
      ? ` Следующая по регламенту (7500 км / 6 мес.): ${[nextDate, nextKm].filter(Boolean).join(' или ')}.`
      : '';

  return {
    handled: true,
    assistant_message: `${lastPart}${nextPart}${statusLine} Могу оформить запись на замену масла.`,
    maintenance_cta: {
      vehicleId: vehicle.id,
      action: 'book',
      category: 'oil_change',
      status: plan.status,
      nextDueAt: plan.plan?.nextDueAt ?? null,
      nextDueMileage: plan.plan?.nextDueMileage ?? null,
    },
    stage: 'SERVICE_HISTORY',
    extracted_hint: {
      car_make: vehicle.make,
      car_model: vehicle.model,
      year: vehicle.year,
      mileage: vehicle.currentMileageKm,
    },
    plan,
  };
}

export { buildOilMaintenancePlan };
