import type { LucideIcon } from 'lucide-react';
import {
  Ban,
  Clock,
  Construction,
  CreditCard,
  Gauge,
  LogIn,
  ServerCrash,
  Unplug,
} from 'lucide-react';

export type StatusErrorCode = 401 | 402 | 403 | 429 | 500 | 502 | 503 | 504;

export type StatusErrorAction = {
  to: string;
  label: string;
  variant: 'primary' | 'outline';
  /** Reload current page instead of navigating */
  reload?: boolean;
};

export type StatusErrorConfig = {
  code: StatusErrorCode;
  title: string;
  metaTitle: string;
  metaDescription: string;
  badge: string;
  lead: string;
  icon: LucideIcon;
  panelTitle: string;
  panelSubtitle: string;
  tips: string[];
  actions: StatusErrorAction[];
};

export const STATUS_ERROR_CATALOG: Record<StatusErrorCode, StatusErrorConfig> = {
  401: {
    code: 401,
    title: 'Сначала нужно войти',
    metaTitle: 'Требуется вход',
    metaDescription: 'Для просмотра этого раздела необходима авторизация.',
    badge: 'Нужна авторизация',
    lead: 'Этот раздел доступен только после входа. Авторизуйтесь — и мы вернём вас обратно на нужную страницу.',
    icon: LogIn,
    panelTitle: 'Как продолжить',
    panelSubtitle: 'Пара быстрых шагов',
    tips: [
      'Войдите в аккаунт или зарегистрируйтесь',
      'Проверьте, что сессия не истекла',
      'Если вход не проходит — очистите cookies и попробуйте снова',
    ],
    actions: [
      { to: '/login', label: 'Войти', variant: 'primary' },
      { to: '/register', label: 'Регистрация', variant: 'outline' },
    ],
  },
  402: {
    code: 402,
    title: 'Нужна оплата услуги',
    metaTitle: 'Требуется оплата',
    metaDescription: 'Доступ к разделу открывается после оплаты.',
    badge: 'Оплата не подтверждена',
    lead: 'Раздел или услуга откроются после успешной оплаты. Если вы уже оплатили — обновите страницу или свяжитесь с сервисом.',
    icon: CreditCard,
    panelTitle: 'Что проверить',
    panelSubtitle: 'Частые причины',
    tips: [
      'Убедитесь, что платёж прошёл успешно',
      'Подождите минуту — подтверждение иногда задерживается',
      'Напишите нам или позвоните, если списание есть, а доступ нет',
    ],
    actions: [
      { to: '/booking', label: 'К записи', variant: 'primary' },
      { to: '/about', label: 'Контакты', variant: 'outline' },
    ],
  },
  403: {
    code: 403,
    title: 'Сюда путь закрыт',
    metaTitle: 'Доступ ограничен',
    metaDescription: 'Недостаточно прав для просмотра этого раздела.',
    badge: 'Доступ ограничен',
    lead: 'У вашей роли нет прав на этот раздел кабинета — как в сервисной зоне без пропуска. Вернитесь в доступную зону или войдите под нужным аккаунтом.',
    icon: Ban,
    panelTitle: 'Куда можно',
    panelSubtitle: 'Доступные направления',
    tips: [
      'Клиентский кабинет — обращения и записи',
      'Если вы сотрудник — войдите под рабочей учёткой',
      'Нужен доступ? Обратитесь к администратору сервиса',
    ],
    actions: [
      { to: '/', label: 'На главную', variant: 'primary' },
      { to: '/dashboard/client', label: 'В кабинет', variant: 'outline' },
    ],
  },
  429: {
    code: 429,
    title: 'Слишком много запросов',
    metaTitle: 'Слишком много запросов',
    metaDescription: 'Превышен лимит запросов. Подождите немного и повторите.',
    badge: 'Притормозите',
    lead: 'Сервис временно ограничил частоту обращений, чтобы всё работало стабильно. Подождите немного и обновите страницу.',
    icon: Gauge,
    panelTitle: 'Что делать',
    panelSubtitle: 'Короткая пауза поможет',
    tips: [
      'Подождите 30–60 секунд',
      'Не обновляйте страницу десятки раз подряд',
      'Если лимит не снимается — напишите в поддержку',
    ],
    actions: [
      { to: '/', label: 'На главную', variant: 'primary' },
      { to: '#', label: 'Обновить', variant: 'outline', reload: true },
    ],
  },
  500: {
    code: 500,
    title: 'У нас внутренний сбой',
    metaTitle: 'Ошибка сервера',
    metaDescription: 'На сервере произошла ошибка. Попробуйте позже.',
    badge: 'Сбой сервера',
    lead: 'Что-то пошло не так на нашей стороне. Мы уже чиним — попробуйте обновить страницу чуть позже.',
    icon: ServerCrash,
    panelTitle: 'Пока ждёте',
    panelSubtitle: 'Можно сделать так',
    tips: [
      'Обновите страницу через минуту',
      'Проверьте другие разделы сайта',
      'Если ошибка повторяется — позвоните в сервис',
    ],
    actions: [
      { to: '#', label: 'Обновить', variant: 'primary', reload: true },
      { to: '/', label: 'На главную', variant: 'outline' },
    ],
  },
  502: {
    code: 502,
    title: 'Сервис не отвечает',
    metaTitle: 'Шлюз недоступен',
    metaDescription: 'Сервис временно не отвечает. Попробуйте позже.',
    badge: 'Плохой шлюз',
    lead: 'Связь с сервером оборвалась — как диагностика без питания сканера. Обычно это быстро проходит, попробуйте ещё раз.',
    icon: Unplug,
    panelTitle: 'Пока на линии тишина',
    panelSubtitle: 'Что поможет',
    tips: [
      'Подождите минуту и обновите страницу',
      'Проверьте интернет-соединение',
      'Запишитесь по телефону, если срочно',
    ],
    actions: [
      { to: '#', label: 'Повторить', variant: 'primary', reload: true },
      { to: '/', label: 'На главную', variant: 'outline' },
    ],
  },
  503: {
    code: 503,
    title: 'Сервис на обслуживании',
    metaTitle: 'Сервис недоступен',
    metaDescription: 'Сервис временно недоступен. Ведутся технические работы.',
    badge: 'Техработы',
    lead: 'Сейчас проводим обслуживание — сервис скоро вернётся в строй. Загляните чуть позже или свяжитесь с нами напрямую.',
    icon: Construction,
    panelTitle: 'На это время',
    panelSubtitle: 'Альтернативы',
    tips: [
      'Обновите страницу через несколько минут',
      'Запись и консультация могут быть временно недоступны',
      'Срочный вопрос — звоните по телефону сервиса',
    ],
    actions: [
      { to: '#', label: 'Обновить', variant: 'primary', reload: true },
      { to: '/about', label: 'Контакты', variant: 'outline' },
    ],
  },
  504: {
    code: 504,
    title: 'Ответ задержался',
    metaTitle: 'Превышено время ожидания',
    metaDescription: 'Сервер слишком долго не отвечал. Попробуйте ещё раз.',
    badge: 'Таймаут шлюза',
    lead: 'Запрос ушёл, но ответ не успел вернуться вовремя. Часто помогает повторная попытка через несколько секунд.',
    icon: Clock,
    panelTitle: 'Что попробовать',
    panelSubtitle: 'Быстрые действия',
    tips: [
      'Обновите страницу и повторите действие',
      'Упростите запрос, если отправляли большой объём данных',
      'Если таймаут повторяется — сообщите нам',
    ],
    actions: [
      { to: '#', label: 'Повторить', variant: 'primary', reload: true },
      { to: '/', label: 'На главную', variant: 'outline' },
    ],
  },
};

export const STATUS_ERROR_CODES = Object.keys(STATUS_ERROR_CATALOG).map(Number) as StatusErrorCode[];

export function isStatusErrorCode(value: number): value is StatusErrorCode {
  return value in STATUS_ERROR_CATALOG;
}
