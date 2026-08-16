export type GuideSectionId =
  | 'shift'
  | 'desk'
  | 'queue'
  | 'request'
  | 'calendar'
  | 'clients'
  | 'contacts'
  | 'ai'
  | 'keys';

export type GuideLegendTone = 'hot' | 'accent' | 'warn' | 'ok' | 'quiet';

export type GuideLegendItem = {
  tone?: GuideLegendTone;
  label: string;
  hint: string;
};

export type GuideSection = {
  id: GuideSectionId;
  title: string;
  lead: string;
  steps: string[];
  legend?: GuideLegendItem[];
  hash: string;
  pathMatch: (pathname: string) => boolean;
};

export const QUEUE_STATUS_HINTS: Record<string, string> = {
  NEW: 'Ещё никто не взял. Назначьте на себя и позвоните.',
  IN_PROGRESS: 'Вы на связи с клиентом, записи ещё нет.',
  SCHEDULED: 'Есть запись в календаре.',
  COMPLETED: 'Работы закрыты, клиент забрал авто.',
  CANCELLED: 'Обращение сняли. Клиент больше не пишет в эту заявку.',
};

export const QUEUE_STATUS_FLOW: GuideLegendItem[] = [
  { tone: 'warn', label: 'Новая', hint: QUEUE_STATUS_HINTS.NEW },
  { tone: 'accent', label: 'В работе', hint: QUEUE_STATUS_HINTS.IN_PROGRESS },
  { tone: 'quiet', label: 'Запланирована', hint: QUEUE_STATUS_HINTS.SCHEDULED },
  { tone: 'ok', label: 'Завершена', hint: QUEUE_STATUS_HINTS.COMPLETED },
  { tone: 'quiet', label: 'Отменена', hint: QUEUE_STATUS_HINTS.CANCELLED },
];

export const WORKDESK_SIGNAL_LEGEND: GuideLegendItem[] = [
  { tone: 'hot', label: 'Красный', hint: 'Без ответа дольше 15 минут или сбой выгрузки в учёт.' },
  { tone: 'accent', label: 'Акцент', hint: 'Новые заявки и сообщения с сайта, которые ещё не взяли.' },
  { tone: 'warn', label: 'Жёлтый', hint: 'Нужно оценить диагноз ИИ.' },
];

export const CONTACT_FLOW: GuideLegendItem[] = [
  { tone: 'warn', label: 'Новое', hint: 'Клиент написал с формы. Позвоните.' },
  { tone: 'accent', label: 'В работе', hint: 'Вы занялись, коллеги не дублируют звонок.' },
  { tone: 'ok', label: 'Заявка', hint: 'Создали обращение в очереди.' },
  { tone: 'quiet', label: 'Закрыто', hint: 'Без заявки: спам, ошибка или клиент передумал.' },
];

export const FUNNEL_STEPS: GuideLegendItem[] = [
  { label: 'Консультации', hint: 'Клиент описал симптомы ассистенту.' },
  { label: 'Заявки', hint: 'Обращение попало в очередь менеджера.' },
  { label: 'Записи', hint: 'Назначили визит в сервис.' },
  { label: 'Завершено', hint: 'Работы закрыты.' },
];

export const MANAGER_GUIDE_SECTIONS: GuideSection[] = [
  {
    id: 'shift',
    title: 'Как устроена смена',
    lead: 'Рабочий стол показывает, что горит. Очередь и календарь - где работать руками.',
    hash: 'shift',
    pathMatch: () => false,
    steps: [
      'Сначала разберите красные карточки на столе: клиенты без ответа.',
      'Новые заявки возьмите на себя, позвоните, затем поставьте статус «В работе».',
      'Когда договорились о визите, назначьте запись. Статус станет «Запланирована».',
      'Сообщения с сайта - это форма, не очередь. Сначала звонок, потом заявка.',
      'После ремонта отметьте, попал ли ИИ в причину: так кабинет учится.',
    ],
  },
  {
    id: 'desk',
    title: 'Рабочий стол',
    lead: 'Сначала красные карточки, потом очередь смены.',
    hash: 'desk',
    pathMatch: (pathname) => pathname === '/dashboard/manager' || pathname === '/dashboard/manager/',
    steps: [
      'Верхний ряд - то, что требует действия сегодня.',
      'Нижний ряд - снимок смены: сколько в работе, на вас и в календаре.',
      'Очередь смены собирает заявки, сообщения с сайта и оценки ИИ в одном списке.',
      'Справа - ближайшая запись и события. «Не ушло в учёт» значит, выгрузка в 1С или CRM не прошла.',
    ],
    legend: WORKDESK_SIGNAL_LEGEND,
  },
  {
    id: 'queue',
    title: 'Очередь',
    lead: 'Все обращения после диагностики и заявок с сайта. Сначала те, кто ждёт ответ.',
    hash: 'queue',
    pathMatch: (pathname) =>
      /\/requests\/?$/.test(pathname) || pathname.endsWith('/operations/requests'),
    steps: [
      '«Мои» показывает только назначенные на вас. «Все» - общая очередь смены.',
      'Список удобен для звонков. Доска - чтобы двигать статусы колонками.',
      'Срочность ставит ИИ по симптомам, это не приоритет сервиса. Наведите на бейдж, чтобы прочитать.',
      'Выделите несколько строк, чтобы взять на себя, сменить статус или отправить в учёт.',
      'Фильтры можно сохранить как пресет, если часто смотрите один и тот же срез.',
    ],
    legend: QUEUE_STATUS_FLOW,
  },
  {
    id: 'request',
    title: 'Карточка заявки',
    lead: 'Один клиент, одно обращение: статус, звонок, запись и переписка.',
    hash: 'request',
    pathMatch: (pathname) => /\/requests\/[^/]+/.test(pathname),
    steps: [
      'Статус и менеджер - в шапке. «На себя» назначает заявку вам.',
      '«Сводка» - что случилось и что сделать сейчас.',
      '«Диалог ИИ» - разбор ассистента и оценка диагноза. «Переписка» - вы с клиентом.',
      '«Работы» - что сделали в сервисе. «История и учёт» - смена статусов и выгрузка в 1С или CRM.',
      '«В учёт» отправляет карточку в подключённую систему, если админ её настроил.',
    ],
  },
  {
    id: 'calendar',
    title: 'Календарь',
    lead: 'Записи на обслуживание: кто приедет, подтвердили ли визит.',
    hash: 'calendar',
    pathMatch: (pathname) => pathname.includes('/calendar') || pathname.includes('/bookings'),
    steps: [
      '«Без подтверждения» - клиент ещё не сказал, что приедет.',
      '«Мои» - записи по заявкам, которые назначены на вас.',
      '«С заявкой» прячет свободные слоты без обращения в очереди.',
      'Полоса загрузки показывает, насколько день уже занят. Высокий столбик - плотный день.',
      'Цвета: жёлтый ещё согласовать, синий приедет, бирюзовый уже в сервисе, зелёный работу закрыли. Легенда «Как читать записи».',
    ],
  },
  {
    id: 'clients',
    title: 'Клиенты',
    lead: 'Карточка клиента: гараж, заявки, запись и сумма закрытых работ.',
    hash: 'clients',
    pathMatch: (pathname) => pathname.includes('/clients'),
    steps: [
      '«Активные» - есть заявка или визит в работе.',
      '«Без кабинета» - человек оставил заявку или форму, не регистрируясь на сайте.',
      'Выручка - сумма закрытых работ, не прогноз.',
      'Звонок и копия номера доступны из строки, досье открывается по клику.',
    ],
  },
  {
    id: 'contacts',
    title: 'Сообщения с сайта',
    lead: 'Это форма с сайта, не очередь заявок. Сначала звонок, потом заявка.',
    hash: 'contacts',
    pathMatch: (pathname) => pathname.includes('/contacts'),
    steps: [
      'Новое сообщение возьмите «В работу», чтобы коллеги не звонили вторым.',
      'Если клиент готов в сервис, нажмите «Создать заявку»: обращение появится в очереди.',
      'Если это спам, ошибка или человек передумал - закройте без заявки.',
    ],
    legend: CONTACT_FLOW,
  },
  {
    id: 'ai',
    title: 'Качество ИИ',
    lead: 'Сверьте предварительный разбор с тем, что подтвердили в сервисе.',
    hash: 'ai',
    pathMatch: (pathname) => pathname.includes('/ai-quality') || pathname.includes('/ai/feedback'),
    steps: [
      '«Совпало с сервисом» - доля отметок «верный». Считается только по оценкам, не по пустому периоду.',
      '«Полезен в сервисе» - верный плюс частично: направление было полезным.',
      'Очередь слева - заявки старше суток без отметки. Оцените, чтобы ИИ не повторял ошибку.',
      'Таблица выгрузки нужна для разбора смены, не для клиента.',
    ],
  },
  {
    id: 'keys',
    title: 'Горячие клавиши',
    lead: 'Поиск по кабинету не уходит с текущего экрана.',
    hash: 'keys',
    pathMatch: () => false,
    steps: [
      'Ctrl+K (на Mac: Cmd+K) открывает поиск разделов и фильтров очереди.',
      'На очереди клавиша / ставит курсор в поиск по клиенту, телефону или авто.',
      'Esc снимает массовый выбор заявок.',
      'Справку можно открыть в любой момент кнопкой в шапке.',
    ],
  },
];

export type ManagerOnboardingStep = {
  id: string;
  sectionId: GuideSectionId;
  title: string;
  lead: string;
  bullets: string[];
  to: string;
  cta: string;
  accent: 'desk' | 'queue' | 'request' | 'calendar';
};

export const MANAGER_ONBOARDING_STEPS: ManagerOnboardingStep[] = [
  {
    id: 'desk',
    sectionId: 'desk',
    title: 'Рабочий стол смены',
    lead: 'Сначала красные карточки: клиенты без ответа дольше 15 минут.',
    bullets: [
      'Верхний ряд - то, что нельзя откладывать',
      'Очередь смены собирает заявки, форму с сайта и оценки ИИ',
      'Справа ближайшая запись на сегодня',
    ],
    to: '/dashboard/manager',
    cta: 'К столу',
    accent: 'desk',
  },
  {
    id: 'queue',
    sectionId: 'queue',
    title: 'Очередь заявок',
    lead: 'Возьмите новую на себя, позвоните, затем смените статус.',
    bullets: [
      'Новая - ещё никто не взял',
      'В работе - вы на связи, записи нет',
      'Запланирована - визит уже в календаре',
    ],
    to: '/dashboard/manager/requests',
    cta: 'К очереди',
    accent: 'queue',
  },
  {
    id: 'request',
    sectionId: 'request',
    title: 'Карточка заявки',
    lead: 'Звонок, запись и переписка с клиентом живут в одном обращении.',
    bullets: [
      'Диалог ИИ - разбор ассистента, его оценивают после ремонта',
      'Переписка - сообщения вам и клиенту, не чат с ИИ',
      'В учёт - выгрузка в 1С или CRM, если систему подключил админ',
    ],
    to: '/dashboard/manager/requests',
    cta: 'К заявкам',
    accent: 'request',
  },
  {
    id: 'calendar',
    sectionId: 'calendar',
    title: 'Календарь и сообщения',
    lead: 'Запись - визит в сервис. Сообщения с сайта - отдельная форма, не очередь.',
    bullets: [
      'Подтвердите визит, если клиент ещё не ответил',
      'С формы сначала позвоните, потом создайте заявку',
      'Справка в шапке открывается в любой момент',
    ],
    to: '/dashboard/manager/calendar',
    cta: 'К календарю',
    accent: 'calendar',
  },
];

export const MANAGER_REQUEST_TAB_HINTS: Record<string, string> = {
  summary: 'Что случилось и что сделать сейчас',
  consultation: 'Разбор ассистента и оценка диагноза',
  messages: 'Переписка с клиентом, не с ИИ',
  works: 'Что сделали в сервисе',
  history: 'Смена статусов и выгрузка в учёт',
};

export const MANAGER_HELP_PATH = '/dashboard/manager/help';

const NAV_GUIDE_IDS: Record<string, GuideSectionId> = {
  desk: 'desk',
  requests: 'queue',
  calendar: 'calendar',
  clients: 'clients',
  contacts: 'contacts',
  'ai-quality': 'ai',
};

export function guideSectionById(id: GuideSectionId): GuideSection {
  const section = MANAGER_GUIDE_SECTIONS.find((item) => item.id === id);
  if (!section) throw new Error(`Unknown guide section: ${id}`);
  return section;
}

export function guideSectionForPath(pathname: string): GuideSection {
  const match = MANAGER_GUIDE_SECTIONS.find((section) => section.pathMatch(pathname));
  return match ?? guideSectionById('desk');
}

export function guideSectionIdForNav(navId: string): GuideSectionId | null {
  return NAV_GUIDE_IDS[navId] ?? null;
}

export function helpHref(hash?: string): string {
  return hash ? `${MANAGER_HELP_PATH}#${hash}` : MANAGER_HELP_PATH;
}
