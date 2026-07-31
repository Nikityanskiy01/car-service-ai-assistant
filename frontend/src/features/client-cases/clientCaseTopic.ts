import type { ClientCase, ClientCaseKind, ClientCaseStage } from './types';

export type ClientCaseTopic =
  | 'diagnostics'
  | 'repair'
  | 'maintenance'
  | 'tires'
  | 'electrics'
  | 'other';

export type ClientCaseSort = 'recent' | 'oldest' | 'vehicle' | 'stage';

export const CLIENT_CASE_TOPIC_META: Record<
  ClientCaseTopic,
  { label: string; shortLabel: string; tone: string }
> = {
  diagnostics: { label: 'Диагностика', shortLabel: 'Диагностика', tone: 'new' },
  repair: { label: 'Ремонт', shortLabel: 'Ремонт', tone: 'active' },
  maintenance: { label: 'Обслуживание', shortLabel: 'ТО', tone: 'done' },
  tires: { label: 'Шины', shortLabel: 'Шины', tone: 'scheduled' },
  electrics: { label: 'Электрика', shortLabel: 'Электрика', tone: 'confirmed' },
  other: { label: 'Прочее', shortLabel: 'Прочее', tone: 'muted' },
};

export const CLIENT_CASE_TOPICS = Object.keys(CLIENT_CASE_TOPIC_META) as ClientCaseTopic[];

const SERVICE_MARKERS = [
  'замена масла',
  'поменять масло',
  'заменить масло',
  'замена фильтра',
  'замена колодок',
  'замена ремня',
  'шиномонтаж',
  'техническое обслуживание',
  'плановое обслуживание',
  'регламентное обслуживание',
  'техобслуживание',
];

const ELECTRIC_MARKERS = [
  'аккумулятор',
  'генератор',
  'стартер',
  'лампа',
  'фара',
  'электрик',
  'проводка',
  'check engine',
  'ошибка',
  'датчик',
];

const REPAIR_MARKERS = [
  'стук',
  'шум',
  'вибрация',
  'не заводится',
  'троит',
  'перегрев',
  'биение руля',
  'уводит',
  'течь',
  'гремит',
  'стучит',
  'скрип',
  'люфт',
];

function norm(value?: string | null) {
  return String(value || '').trim().toLowerCase();
}

function hasAny(text: string, markers: string[]) {
  return markers.some((marker) => text.includes(marker));
}

function hasServiceToAbbrev(text: string) {
  if (text === 'то' || text === 'т.о.' || text === 'т.о') return true;
  return /(^|[\s,.;:!?])то($|[\s,.;:!?])/i.test(text);
}

function topicFromServiceCategory(name?: string | null): ClientCaseTopic | null {
  const value = norm(name);
  if (!value) return null;
  if (value.includes('диагност')) return 'diagnostics';
  if (value.includes('то') || value.includes('обслуж')) return 'maintenance';
  if (value.includes('шин')) return 'tires';
  if (value.includes('электр')) return 'electrics';
  if (
    value.includes('тормоз') ||
    value.includes('подвес') ||
    value.includes('двигат') ||
    value.includes('трансмис') ||
    value.includes('кузов') ||
    value.includes('ремонт')
  ) {
    return 'repair';
  }
  return null;
}

function topicFromServiceType(serviceType?: string | null): ClientCaseTopic | null {
  switch (serviceType) {
    case 'oil_change':
    case 'filters':
    case 'timing_belt':
    case 'maintenance':
    case 'brake_pads':
      return serviceType === 'brake_pads' ? 'repair' : 'maintenance';
    case 'tire_service':
      return 'tires';
    default:
      return null;
  }
}

function topicFromSymptoms(symptoms: string): ClientCaseTopic | null {
  const text = norm(symptoms);
  if (!text) return null;
  if (hasAny(text, ['шиномонтаж', 'шины', 'колес'])) return 'tires';
  if (hasAny(text, ELECTRIC_MARKERS)) return 'electrics';
  if (hasServiceToAbbrev(text) || hasAny(text, SERVICE_MARKERS)) return 'maintenance';
  if (hasAny(text, REPAIR_MARKERS)) return 'repair';
  return null;
}

export function resolveClientCaseTopic(input: {
  kind: ClientCaseKind;
  symptoms: string;
  requestStatus?: string;
  consultationStatus?: string;
  progressStage?: ClientCaseStage;
  intent?: 'diagnostic' | 'service' | 'unknown' | null;
  serviceType?: string | null;
  serviceCategoryName?: string | null;
}): ClientCaseTopic {
  const fromCategory = topicFromServiceCategory(input.serviceCategoryName);
  if (fromCategory) return fromCategory;

  const fromServiceType = topicFromServiceType(input.serviceType);
  if (fromServiceType) return fromServiceType;

  if (input.intent === 'service') return 'maintenance';
  if (input.intent === 'diagnostic') return 'diagnostics';

  const fromSymptoms = topicFromSymptoms(input.symptoms);
  if (fromSymptoms) return fromSymptoms;

  if (input.kind === 'draft') return 'diagnostics';

  if (
    input.progressStage === 'request' ||
    input.progressStage === 'booking' ||
    input.requestStatus === 'IN_PROGRESS' ||
    input.requestStatus === 'SCHEDULED' ||
    input.requestStatus === 'COMPLETED'
  ) {
    return 'repair';
  }

  return 'other';
}

export function parseClientCaseTopic(value: string | null): ClientCaseTopic | 'all' {
  if (!value || value === 'all') return 'all';
  if ((CLIENT_CASE_TOPICS as string[]).includes(value)) return value as ClientCaseTopic;
  return 'all';
}

export function parseClientCaseSort(value: string | null): ClientCaseSort {
  if (value === 'oldest' || value === 'vehicle' || value === 'stage') return value;
  return 'recent';
}

export function filterCasesByTopic(cases: ClientCase[], topic: ClientCaseTopic | 'all'): ClientCase[] {
  if (topic === 'all') return cases;
  return cases.filter((item) => item.topic === topic);
}

const STAGE_ORDER: Record<ClientCaseStage, number> = {
  diagnosis: 0,
  request: 1,
  booking: 2,
  done: 3,
};

export function sortClientCases(cases: ClientCase[], sort: ClientCaseSort): ClientCase[] {
  const rows = [...cases];
  switch (sort) {
    case 'oldest':
      return rows.sort(
        (a, b) => new Date(a.lastActivityAt).getTime() - new Date(b.lastActivityAt).getTime(),
      );
    case 'vehicle':
      return rows.sort((a, b) => a.title.localeCompare(b.title, 'ru'));
    case 'stage':
      return rows.sort((a, b) => {
        const stageDiff = STAGE_ORDER[a.progressStage] - STAGE_ORDER[b.progressStage];
        if (stageDiff !== 0) return stageDiff;
        return new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime();
      });
    case 'recent':
    default:
      return rows.sort(
        (a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime(),
      );
  }
}

export function countCasesByTopic(cases: ClientCase[]): Record<ClientCaseTopic, number> {
  const counts = Object.fromEntries(CLIENT_CASE_TOPICS.map((topic) => [topic, 0])) as Record<
    ClientCaseTopic,
    number
  >;
  for (const item of cases) {
    counts[item.topic] += 1;
  }
  return counts;
}
