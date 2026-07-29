import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const defaults = {
  client: {
    email: process.env.DEMO_CLIENT_EMAIL || 'client@example.local',
    password: process.env.DEMO_CLIENT_PASSWORD || 'Client-Demo-2026!',
  },
  manager: {
    email: process.env.DEMO_MANAGER_EMAIL || 'manager@example.local',
    password: process.env.DEMO_MANAGER_PASSWORD || 'Manager-Demo-2026!',
  },
  admin: {
    email: process.env.DEMO_ADMIN_EMAIL || 'admin@example.local',
    password: process.env.DEMO_ADMIN_PASSWORD || 'Admin-Demo-2026!',
  },
};

function hoursFromNow(h) {
  return new Date(Date.now() + h * 3600_000);
}

function hoursAgo(h) {
  return new Date(Date.now() - h * 3600_000);
}

async function upsertUser({ email, password, fullName, phone, role }) {
  const passwordHash = await bcrypt.hash(password, 10);
  return prisma.user.upsert({
    where: { email },
    update: { passwordHash, fullName, phone, role, blocked: false },
    create: { email, passwordHash, fullName, phone, role },
  });
}

async function resetOperationalData() {
  // Wipe demo operational tables so re-seed is idempotent (demo DB only).
  await prisma.integrationAttempt.deleteMany();
  await prisma.integrationJob.deleteMany();
  await prisma.integrationConflict.deleteMany();
  await prisma.integrationAuditEvent.deleteMany();
  await prisma.integrationWebhookEvent.deleteMany();
  await prisma.externalEntityLink.deleteMany();
  await prisma.integrationOutboxEvent.deleteMany();
  await prisma.integrationSyncCursor.deleteMany();
  await prisma.integrationStatusMapping.deleteMany();
  await prisma.integrationCredential.deleteMany();
  await prisma.integrationConnection.deleteMany();

  await prisma.serviceBookingAuditLog.deleteMany();
  await prisma.serviceBooking.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.requestFollowUpMessage.deleteMany();
  await prisma.serviceRequest.deleteMany();
  await prisma.consultationReport.deleteMany();
  await prisma.message.deleteMany();
  await prisma.diagnosticRecommendation.deleteMany();
  await prisma.extractedDiagnosticData.deleteMany();
  await prisma.consultationSession.deleteMany();
  await prisma.contactSubmission.deleteMany();
  await prisma.adminAuditEvent.deleteMany();
  await prisma.siteContentVersion.deleteMany();
  await prisma.siteContentBlock.deleteMany();
}

async function createCase({
  clientId,
  managerId,
  status,
  make,
  model,
  year,
  mileage,
  symptoms,
  conditions,
  recommendations,
  progressPercent,
  confidencePercent,
  costFromMinor,
  preliminaryNote,
  messages,
  followUps = [],
  booking,
  createdAt,
  guest,
}) {
  const session = await prisma.consultationSession.create({
    data: {
      clientId: clientId || null,
      guestName: guest?.name || null,
      guestPhone: guest?.phone || null,
      guestToken: guest ? `demo-guest-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` : null,
      status: status === 'NEW' || status === 'IN_PROGRESS' ? 'COMPLETED' : status === 'CANCELLED' ? 'ABANDONED' : 'COMPLETED',
      progressPercent,
      confidencePercent,
      costFromMinor,
      preliminaryNote,
      createdAt: createdAt || undefined,
      flowState: { stage: progressPercent >= 100 ? 'COMPLETED' : 'CLARIFYING' },
      messages: { create: messages },
      extracted: {
        create: { make, model, year, mileage, symptoms, problemConditions: conditions },
      },
      recommendations: {
        create: recommendations.map((r) => ({
          title: r.title,
          probabilityPercent: r.probabilityPercent,
        })),
      },
    },
  });

  const request = await prisma.serviceRequest.create({
    data: {
      clientId: clientId || null,
      guestName: guest?.name || null,
      guestPhone: guest?.phone || null,
      guestEmail: guest?.email || null,
      consultationSessionId: session.id,
      status,
      snapshotMake: make,
      snapshotModel: model,
      snapshotSymptoms: symptoms,
      createdAt: createdAt || undefined,
      followUpMessages: followUps.length
        ? {
            create: followUps.map((body) => ({ authorId: managerId, body })),
          }
        : undefined,
      notifications: {
        create: {
          payload: JSON.stringify({ text: `Заявка: ${make} ${model} — ${symptoms}` }),
          status: 'SENT',
          attempts: 1,
        },
      },
    },
  });

  if (booking) {
    await prisma.serviceBooking.create({
      data: {
        clientId: clientId || null,
        guestName: guest?.name || null,
        guestPhone: guest?.phone || null,
        guestEmail: guest?.email || null,
        serviceRequestId: request.id,
        preferredAt: booking.preferredAt,
        status: booking.status,
        notes: booking.notes,
      },
    });
  }

  return { session, request };
}

async function main() {
  await resetOperationalData();

  const [client, manager, admin] = await Promise.all([
    upsertUser({
      email: defaults.client.email,
      password: defaults.client.password,
      fullName: 'Иван Петров',
      phone: '+79990000001',
      role: 'CLIENT',
    }),
    upsertUser({
      email: defaults.manager.email,
      password: defaults.manager.password,
      fullName: 'Марина Орлова',
      phone: '+79990000002',
      role: 'MANAGER',
    }),
    upsertUser({
      email: defaults.admin.email,
      password: defaults.admin.password,
      fullName: 'Админ Демо',
      phone: '+79990000003',
      role: 'ADMINISTRATOR',
    }),
  ]);

  // Keep exactly one user per role for demo.
  await prisma.refreshToken.deleteMany({
    where: {
      user: {
        email: {
          in: ['anna.client@example.local', 'sergey.client@example.local', 'manager2@example.local'],
        },
      },
    },
  });
  await prisma.user.deleteMany({
    where: {
      email: {
        in: ['anna.client@example.local', 'sergey.client@example.local', 'manager2@example.local'],
      },
    },
  });

  const categories = [
    { slug: 'diagnostics', name: 'Диагностика', description: 'Комплексная первичная и компьютерная диагностика' },
    { slug: 'brakes', name: 'Тормозная система', description: 'Проверка и обслуживание тормозной системы' },
    { slug: 'suspension', name: 'Подвеска', description: 'Диагностика и ремонт элементов подвески' },
    { slug: 'engine', name: 'Двигатель', description: 'Диагностика и ремонт ДВС' },
    { slug: 'transmission', name: 'Трансмиссия', description: 'МКПП / АКПП / вариатор' },
    { slug: 'electrics', name: 'Электрика', description: 'Электрооборудование и блоки управления' },
    { slug: 'maintenance', name: 'ТО', description: 'Плановое техническое обслуживание' },
    { slug: 'ac', name: 'Кондиционер', description: 'Заправка и ремонт климатических систем' },
  ];
  for (const category of categories) {
    await prisma.serviceCategory.upsert({
      where: { slug: category.slug },
      update: category,
      create: category,
    });
  }

  const cases = [
    {
      clientId: client.id,
      status: 'NEW',
      make: 'Toyota',
      model: 'Camry',
      year: 2018,
      mileage: 132000,
      symptoms: 'Вибрация при торможении',
      conditions: 'Скорость 70–90 км/ч',
      progressPercent: 100,
      confidencePercent: 78,
      costFromMinor: 12000,
      preliminaryNote: 'Вероятен износ тормозных дисков. Нужна очная диагностика.',
      recommendations: [
        { title: 'Износ тормозных дисков', probabilityPercent: 78 },
        { title: 'Неравномерный износ колодок', probabilityPercent: 55 },
      ],
      messages: [
        { sender: 'USER', content: 'Toyota Camry 2018, 132000 км. При торможении вибрация в руль.' },
        { sender: 'ASSISTANT', content: 'Вибрация появляется на высокой скорости или в любом режиме?' },
        { sender: 'USER', content: 'Чаще на 70–90 км/ч.' },
        { sender: 'ASSISTANT', content: 'Предварительно — диски/колодки. Рекомендую диагностику тормозов в 1–2 дня.' },
      ],
      followUps: ['Добрый день! Готовы записать на диагностику тормозов завтра после 12:00.'],
      booking: {
        preferredAt: hoursFromNow(26),
        status: 'PENDING',
        notes: 'Диагностика тормозной системы',
      },
      createdAt: hoursAgo(5),
    },
    {
      clientId: client.id,
      status: 'IN_PROGRESS',
      make: 'Kia',
      model: 'Rio',
      year: 2019,
      mileage: 98000,
      symptoms: 'Стук спереди на кочках',
      conditions: 'Город, мелкие неровности',
      progressPercent: 100,
      confidencePercent: 71,
      costFromMinor: 18000,
      preliminaryNote: 'Возможен износ стоек/опор. Нужна проверка подвески.',
      recommendations: [
        { title: 'Износ передних стоек', probabilityPercent: 71 },
        { title: 'Опоры амортизаторов', probabilityPercent: 48 },
      ],
      messages: [
        { sender: 'USER', content: 'Kia Rio 2019, стук спереди на кочках, пробег 98000.' },
        { sender: 'ASSISTANT', content: 'Стук глухой или звонкий? С одной стороны или с обеих?' },
        { sender: 'USER', content: 'Глухой, больше справа.' },
        { sender: 'ASSISTANT', content: 'Похоже на стойку/опору. Запишитесь на диагностику ходовой.' },
      ],
      followUps: [
        'Приняли заявку в работу. Нужны фото/видео стука, если есть.',
        'Предлагаем слот сегодня после 17:00 или завтра утром.',
      ],
      booking: {
        preferredAt: hoursFromNow(4),
        status: 'CONFIRMED',
        notes: 'Проверка подвески, пост 2',
      },
      createdAt: hoursAgo(30),
    },
    {
      clientId: client.id,
      status: 'SCHEDULED',
      make: 'Hyundai',
      model: 'Solaris',
      year: 2017,
      mileage: 90500,
      symptoms: 'Плановое ТО 90 тыс.',
      conditions: 'Регламент производителя',
      progressPercent: 100,
      confidencePercent: 90,
      costFromMinor: 8900,
      preliminaryNote: 'Регламентное ТО: масло, фильтры, свечи по пробегу.',
      recommendations: [{ title: 'Плановое ТО', probabilityPercent: 95 }],
      messages: [
        { sender: 'USER', content: 'Hyundai Solaris 2017, нужно ТО на 90 тысяч.' },
        { sender: 'ASSISTANT', content: 'Подтвердите: масло ДВС, масляный/воздушный/салонный фильтры, свечи?' },
        { sender: 'USER', content: 'Да, полный комплект.' },
        { sender: 'ASSISTANT', content: 'Ориентир по работам/материалам готов. Можно записаться в день обращения.' },
      ],
      followUps: ['Запись подтверждена на субботу 11:00. Возьмите сервисную книжку.'],
      booking: {
        preferredAt: hoursFromNow(72),
        status: 'CONFIRMED',
        notes: 'ТО-90: масло + фильтры + свечи',
      },
      createdAt: hoursAgo(48),
    },
    {
      clientId: client.id,
      status: 'COMPLETED',
      make: 'Volkswagen',
      model: 'Polo',
      year: 2020,
      mileage: 64000,
      symptoms: 'Плавающие обороты ХХ',
      conditions: 'На холодную и после прогрева',
      progressPercent: 100,
      confidencePercent: 66,
      costFromMinor: 4500,
      preliminaryNote: 'Возможна загрязнённая дроссельная заслонка.',
      recommendations: [
        { title: 'Чистка дроссельной заслонки', probabilityPercent: 66 },
        { title: 'Датчик ХХ / адаптация', probabilityPercent: 40 },
      ],
      messages: [
        { sender: 'USER', content: 'VW Polo 2020, плавают обороты на холостых.' },
        { sender: 'ASSISTANT', content: 'Горит Check Engine? Были ошибки по дросселю?' },
        { sender: 'USER', content: 'Check нет, ошибок не смотрели.' },
        { sender: 'ASSISTANT', content: 'Рекомендую компьютерную диагностику и осмотр дросселя.' },
      ],
      followUps: ['Работы выполнены: чистка дросселя + адаптация. Обороты стабильны.'],
      booking: {
        preferredAt: hoursAgo(20),
        status: 'CONFIRMED',
        notes: 'Выполнено',
      },
      createdAt: hoursAgo(96),
    },
    {
      clientId: client.id,
      status: 'IN_PROGRESS',
      make: 'Skoda',
      model: 'Octavia',
      year: 2016,
      mileage: 154000,
      symptoms: 'Рывки АКПП на 2–3',
      conditions: 'Городской цикл, прогретая коробка',
      progressPercent: 100,
      confidencePercent: 62,
      costFromMinor: 22000,
      preliminaryNote: 'Возможна необходимость замены масла/фильтра АКПП и адаптации.',
      recommendations: [
        { title: 'Замена масла АКПП', probabilityPercent: 62 },
        { title: 'Соленоиды / механика АКПП', probabilityPercent: 28 },
      ],
      messages: [
        { sender: 'USER', content: 'Octavia 2016 DSG/АКПП, рывки при переключении 2-3.' },
        { sender: 'ASSISTANT', content: 'Когда меняли масло в коробке в последний раз?' },
        { sender: 'USER', content: 'Не помню, возможно никогда.' },
        { sender: 'ASSISTANT', content: 'С высокой вероятностью поможет сервис АКПП. Нужна диагностика на посту.' },
      ],
      followUps: ['Ждём вас на диагностику АКПП. Не прогревайте агрессивно до визита.'],
      booking: {
        preferredAt: hoursFromNow(50),
        status: 'PENDING',
        notes: 'Диагностика АКПП',
      },
      createdAt: hoursAgo(12),
    },
    {
      clientId: client.id,
      status: 'NEW',
      make: 'Renault',
      model: 'Duster',
      year: 2015,
      mileage: 178000,
      symptoms: 'АКБ садится за ночь',
      conditions: 'Стоянка во дворе, без сигнализации',
      progressPercent: 85,
      confidencePercent: 58,
      costFromMinor: 3500,
      preliminaryNote: 'Возможна паразитная утечка тока или износ АКБ.',
      recommendations: [
        { title: 'Утечка тока в цепи', probabilityPercent: 58 },
        { title: 'Износ аккумулятора', probabilityPercent: 45 },
      ],
      messages: [
        { sender: 'USER', content: 'Duster 2015, утром АКБ разряжена.' },
        { sender: 'ASSISTANT', content: 'Аккумулятору сколько лет? Есть доп. оборудование?' },
        { sender: 'USER', content: 'АКБ года 3, магнитола нештатная.' },
      ],
      followUps: [],
      booking: null,
      createdAt: hoursAgo(2),
    },
    {
      clientId: client.id,
      status: 'CANCELLED',
      make: 'Lada',
      model: 'Vesta',
      year: 2021,
      mileage: 42000,
      symptoms: 'Шум подшипника ступицы',
      conditions: 'На скорости выше 60',
      progressPercent: 70,
      confidencePercent: 60,
      costFromMinor: 9000,
      preliminaryNote: 'Клиент отменил визит.',
      recommendations: [{ title: 'Ступичный подшипник', probabilityPercent: 70 }],
      messages: [
        { sender: 'USER', content: 'Vesta, гул справа на скорости.' },
        { sender: 'ASSISTANT', content: 'Гул усиливается в поворотах?' },
        { sender: 'USER', content: 'Да, влево сильнее. Пока отложим запись.' },
      ],
      followUps: ['Заявку закрыли по просьбе клиента. Можно открыть снова в любой момент.'],
      booking: {
        preferredAt: hoursAgo(10),
        status: 'CANCELLED',
        notes: 'Клиент отменил',
      },
      createdAt: hoursAgo(60),
    },
    {
      guest: { name: 'Гость Алексей', phone: '+79991112233', email: 'alex.guest@example.local' },
      status: 'NEW',
      make: 'BMW',
      model: '320i',
      year: 2014,
      mileage: 201000,
      symptoms: 'Ошибка двигателя, троение',
      conditions: 'На холодную',
      progressPercent: 90,
      confidencePercent: 64,
      costFromMinor: 15000,
      preliminaryNote: 'Возможны катушки/свечи/форсунки. Нужна компьютерная диагностика.',
      recommendations: [
        { title: 'Катушка зажигания', probabilityPercent: 64 },
        { title: 'Свечи / форсунки', probabilityPercent: 50 },
      ],
      messages: [
        { sender: 'USER', content: 'BMW 320i 2014, троит на холодную, check горит.' },
        { sender: 'ASSISTANT', content: 'Считывали ошибки? Какой код?' },
        { sender: 'USER', content: 'Пока нет, хочу записаться как гость.' },
        { sender: 'ASSISTANT', content: 'Ок. Создайте заявку — менеджер свяжется для записи на диагностику.' },
      ],
      followUps: ['Гостевая заявка: перезвоните клиенту по BMW 320i.'],
      booking: {
        preferredAt: hoursFromNow(8),
        status: 'PENDING',
        notes: 'Гостевая запись на компьютерную диагностику',
      },
      createdAt: hoursAgo(1),
    },
    {
      guest: { name: 'Гость Елена', phone: '+79994445566' },
      status: 'SCHEDULED',
      make: 'Mazda',
      model: 'CX-5',
      year: 2018,
      mileage: 87000,
      symptoms: 'Кондиционер слабо холодит',
      conditions: 'Жара, город',
      progressPercent: 100,
      confidencePercent: 55,
      costFromMinor: 7000,
      preliminaryNote: 'Возможна нехватка фреона или загрязнение радиатора кондиционера.',
      recommendations: [{ title: 'Заправка / проверка герметичности СК', probabilityPercent: 55 }],
      messages: [
        { sender: 'USER', content: 'CX-5, кондиционер дует еле холодным.' },
        { sender: 'ASSISTANT', content: 'Были утечки раньше? Когда заправляли?' },
        { sender: 'USER', content: 'Год назад заправляли.' },
      ],
      followUps: ['Запись на проверку СК подтверждена.'],
      booking: {
        preferredAt: hoursFromNow(100),
        status: 'CONFIRMED',
        notes: 'Диагностика кондиционера',
      },
      createdAt: hoursAgo(18),
    },
    {
      clientId: client.id,
      status: 'COMPLETED',
      make: 'Nissan',
      model: 'Qashqai',
      year: 2013,
      mileage: 166000,
      symptoms: 'Течь масла двигателя',
      conditions: 'После ночной стоянки пятно',
      progressPercent: 100,
      confidencePercent: 72,
      costFromMinor: 11000,
      preliminaryNote: 'Вероятна течь клапанной крышки или сальника.',
      recommendations: [
        { title: 'Прокладка клапанной крышки', probabilityPercent: 72 },
        { title: 'Сальник коленвала', probabilityPercent: 35 },
      ],
      messages: [
        { sender: 'USER', content: 'Qashqai, утром масляное пятно под мотором.' },
        { sender: 'ASSISTANT', content: 'Уровень масла падает заметно? Запах гари?' },
        { sender: 'USER', content: 'Уровень чуть ниже, запаха нет.' },
        { sender: 'ASSISTANT', content: 'Нужен осмотр на подъёмнике. Не откладывайте.' },
      ],
      followUps: ['Течь устранена: замена прокладки клапанной крышки.'],
      booking: {
        preferredAt: hoursAgo(70),
        status: 'CONFIRMED',
        notes: 'Выполнено',
      },
      createdAt: hoursAgo(120),
    },
  ];

  let createdRequests = 0;
  for (const item of cases) {
    await createCase({ ...item, managerId: manager.id });
    createdRequests += 1;
  }

  // Extra standalone bookings (without request) for calendar density
  const extraBookings = [
    {
      clientId: client.id,
      preferredAt: hoursFromNow(1.5),
      status: 'CONFIRMED',
      notes: 'Повторная выдача после ТО',
    },
    {
      clientId: client.id,
      preferredAt: hoursFromNow(30),
      status: 'PENDING',
      notes: 'Шиномонтаж / перекидка',
    },
    {
      guestName: 'Гость Павел',
      guestPhone: '+79997778899',
      preferredAt: hoursFromNow(54),
      status: 'PENDING',
      notes: 'Осмотр перед покупкой авто',
    },
    {
      clientId: client.id,
      preferredAt: hoursAgo(3),
      status: 'CONFIRMED',
      notes: 'Уже на посту',
    },
  ];
  for (const b of extraBookings) {
    await prisma.serviceBooking.create({ data: b });
  }

  // In-progress consultation without request (client cabinet)
  await prisma.consultationSession.create({
    data: {
      clientId: client.id,
      status: 'IN_PROGRESS',
      progressPercent: 35,
      flowState: { stage: 'COLLECTING_SYMPTOMS' },
      messages: {
        create: [
          { sender: 'ASSISTANT', content: 'Опишите марку, модель, пробег и симптомы.' },
          { sender: 'USER', content: 'Camry, только начал — пока думаю, как сформулировать.' },
        ],
      },
      extracted: {
        create: { make: 'Toyota', model: 'Camry', year: 2018, mileage: null, symptoms: null },
      },
    },
  });

  const contacts = [
    {
      fullName: 'Ольга Н.',
      phone: '+79990001122',
      message: 'Подскажите, делаете ли развал после замены рычагов? И сколько roughly по срокам.',
      createdAt: hoursAgo(3),
    },
    {
      fullName: 'Кирилл М.',
      phone: '+79990003344',
      message: 'Нужна запись на компьютерную диагностику на выходные.',
      createdAt: hoursAgo(8),
    },
    {
      fullName: 'Виктория Л.',
      phone: '+79990005566',
      message: 'Интересует ИИ-диагностика: можно ли без регистрации сохранить отчёт?',
      createdAt: hoursAgo(20),
    },
    {
      fullName: 'Андрей С.',
      phone: '+79990007788',
      message: 'Есть ли запчасти в наличии на Camry 2018 (тормозные диски)?',
      createdAt: hoursAgo(40),
    },
    {
      fullName: 'Наталья П.',
      phone: '+79990009900',
      message: 'Хотим корпоративное обслуживание парка из 5 авто. К кому обратиться?',
      createdAt: hoursAgo(55),
    },
  ];
  for (const c of contacts) {
    await prisma.contactSubmission.create({ data: c });
  }

  // Site content blocks for admin CMS variants
  const blocks = [
    {
      key: 'home.hero',
      title: 'Hero главной',
      section: 'home',
      content: 'Узнайте причину неисправности за 2–4 минуты',
      isPublished: true,
    },
    {
      key: 'home.disclaimer',
      title: 'Дисклеймер ИИ',
      section: 'home',
      content: 'Ответ ассистента информационный и не заменяет осмотр на посту.',
      isPublished: true,
    },
    {
      key: 'contacts.hours',
      title: 'Режим работы',
      section: 'contacts',
      content: 'пн–сб 10:00–20:00',
      isPublished: true,
    },
  ];
  for (const block of blocks) {
    const row = await prisma.siteContentBlock.create({ data: block });
    await prisma.siteContentVersion.create({
      data: {
        blockId: row.id,
        content: block.content,
        note: 'Демо-версия',
        createdBy: admin.id,
      },
    });
  }

  await prisma.adminAuditEvent.createMany({
    data: [
      {
        actorId: admin.id,
        action: 'DEMO_SEED',
        entityType: 'system',
        entityId: null,
        payloadJson: { note: 'Полный демо-набор данных' },
      },
      {
        actorId: admin.id,
        action: 'CMS_SITE_ITEM_CREATE',
        entityType: 'site_item',
        entityId: 'demo',
        payloadJson: { kind: 'service', count: 12 },
      },
      {
        actorId: manager.id,
        action: 'REQUEST_STATUS_CHANGE',
        entityType: 'service_request',
        entityId: 'demo',
        payloadJson: { from: 'NEW', to: 'IN_PROGRESS' },
      },
      {
        actorId: admin.id,
        action: 'USER_ROLE_UPDATE',
        entityType: 'user',
        entityId: manager.id,
        payloadJson: { role: 'MANAGER' },
      },
      {
        actorId: admin.id,
        action: 'INTEGRATION_CONNECT',
        entityType: 'integration_connection',
        entityId: 'demo',
        payloadJson: { provider: 'BITRIX24' },
      },
    ],
  });

  const bitrix = await prisma.integrationConnection.create({
    data: {
      name: '[DEMO] Bitrix24 CRM',
      provider: 'BITRIX24',
      versionLabel: 'cloud',
      mode: 'api',
      status: 'CONNECTED',
      enabled: true,
      lastSyncAt: hoursAgo(2),
      capabilitiesJson: { contacts: true, deals: true, webhooks: true },
      configJson: { portal: 'demo.bitrix24.ru', syncIntervalMin: 15 },
      credentials: {
        create: [
          {
            key: 'webhook_url',
            encryptedValue: 'demo-encrypted-webhook',
            maskedValue: 'https://demo.bitrix24.ru/rest/1/***',
          },
        ],
      },
      statusMappings: {
        create: [
          {
            entityType: 'service_request',
            internalStatus: 'NEW',
            externalStatus: 'NEW',
            direction: 'BIDIRECTIONAL',
            sourceOfTruth: 'LOCAL',
          },
          {
            entityType: 'service_request',
            internalStatus: 'IN_PROGRESS',
            externalStatus: 'IN_WORK',
            direction: 'BIDIRECTIONAL',
            sourceOfTruth: 'MANUAL_CONFIRMATION',
          },
        ],
      },
    },
  });

  const amocrm = await prisma.integrationConnection.create({
    data: {
      name: '[DEMO] amoCRM',
      provider: 'AMOCRM',
      versionLabel: 'v4',
      mode: 'api',
      status: 'AUTH_ERROR',
      enabled: true,
      lastErrorCode: 'AUTH_EXPIRED',
      lastErrorMessage: 'Токен истёк — обновите OAuth',
      capabilitiesJson: { leads: true, contacts: true },
      configJson: { subdomain: 'demo-autoservice' },
    },
  });

  await prisma.integrationConnection.create({
    data: {
      name: '[DEMO] 1C УТ',
      provider: 'ONE_C',
      versionLabel: '8.3',
      mode: 'file',
      status: 'REQUIRES_SETUP',
      enabled: false,
      capabilitiesJson: { exchange: true },
      configJson: { path: '/exchange/demo' },
    },
  });

  await prisma.integrationJob.createMany({
    data: [
      {
        connectionId: bitrix.id,
        eventType: 'SYNC_OUTBOUND',
        entityType: 'service_request',
        entityId: 'demo-req-1',
        idempotencyKey: `demo-job-ok-${Date.now()}`,
        status: 'SUCCEEDED',
        attemptCount: 1,
        payloadJson: { action: 'upsert_deal' },
      },
      {
        connectionId: bitrix.id,
        eventType: 'SYNC_OUTBOUND',
        entityType: 'service_request',
        entityId: 'demo-req-2',
        idempotencyKey: `demo-job-pending-${Date.now()}`,
        status: 'PENDING',
        attemptCount: 0,
        payloadJson: { action: 'upsert_deal' },
      },
      {
        connectionId: amocrm.id,
        eventType: 'SYNC_OUTBOUND',
        entityType: 'service_request',
        entityId: 'demo-req-3',
        idempotencyKey: `demo-job-fail-${Date.now()}`,
        status: 'FAILED',
        attemptCount: 3,
        lastErrorCode: 'AUTH_EXPIRED',
        lastErrorMessage: '401 Unauthorized',
        payloadJson: { action: 'upsert_lead' },
      },
      {
        connectionId: bitrix.id,
        eventType: 'SYNC_INBOUND',
        entityType: 'contact',
        entityId: 'demo-contact-1',
        idempotencyKey: `demo-job-retry-${Date.now()}`,
        status: 'RETRYING',
        attemptCount: 2,
        nextAttemptAt: hoursFromNow(0.5),
        lastErrorMessage: 'Temporary timeout',
        payloadJson: { action: 'pull_contact' },
      },
    ],
  });

  await prisma.integrationConflict.create({
    data: {
      connectionId: bitrix.id,
      entityType: 'service_request',
      internalEntityId: 'demo-local-1',
      externalEntityId: 'B24-DEAL-1001',
      field: 'status',
      localValue: 'IN_PROGRESS',
      externalValue: 'NEW',
      status: 'OPEN',
      resolutionNote: null,
    },
  });

  // ——— CMS public content ———
  const cmsItems = [
    {
      kind: 'service',
      title: 'Компьютерная диагностика',
      description: 'Считывание ошибок ЭБУ, проверка датчиков, тест актуаторов и отчёт по найденным кодам.',
      price: 'от 2 000 ₽',
      category: 'Диагностика',
      imageUrl: '/placeholders/works-diagnostics.jpg',
      orderIndex: 1,
      published: true,
    },
    {
      kind: 'service',
      title: 'Диагностика тормозной системы',
      description: 'Проверка дисков, колодок, суппортов и шлангов с фиксацией результата в карточке заявки.',
      price: 'от 2 500 ₽',
      category: 'Тормозная система',
      imageUrl: '/placeholders/works-brakes.jpg',
      orderIndex: 2,
      published: true,
    },
    {
      kind: 'service',
      title: 'Ремонт подвески',
      description: 'Замена стоек, рычагов, сайлентблоков, опор и шаровых с последующей проверкой на яме.',
      price: 'от 4 500 ₽',
      category: 'Подвеска',
      imageUrl: '/placeholders/works-suspension.jpg',
      orderIndex: 3,
      published: true,
    },
    {
      kind: 'service',
      title: 'Развал-схождение',
      description: 'Компьютерная регулировка углов установки колёс после ремонта ходовой.',
      price: 'от 3 200 ₽',
      category: 'Подвеска',
      imageUrl: '/placeholders/gallery-alignment.jpg',
      orderIndex: 4,
      published: true,
    },
    {
      kind: 'service',
      title: 'Плановое ТО',
      description: 'Замена масла, фильтров и технических жидкостей по регламенту производителя.',
      price: 'от 3 900 ₽',
      category: 'ТО',
      imageUrl: '/placeholders/works-service.jpg',
      orderIndex: 5,
      published: true,
    },
    {
      kind: 'service',
      title: 'Диагностика и ремонт АКПП',
      description: 'Проверка давления, адаптация, замена масла и фильтров АКПП / вариатора.',
      price: 'от 5 500 ₽',
      category: 'Трансмиссия',
      imageUrl: '/placeholders/works-transmission.jpg',
      orderIndex: 6,
      published: true,
    },
    {
      kind: 'service',
      title: 'Автоэлектрика',
      description: 'Поиск утечек тока, ремонт проводки, диагностика блоков и датчиков.',
      price: 'от 2 800 ₽',
      category: 'Электрика',
      imageUrl: '/placeholders/works-electrics.jpg',
      orderIndex: 7,
      published: true,
    },
    {
      kind: 'service',
      title: 'Диагностика двигателя',
      description: 'Компрессия, эндоскопия, проверка топливной системы и анализ шума ДВС.',
      price: 'от 3 500 ₽',
      category: 'Двигатель',
      imageUrl: '/placeholders/gallery-bay.jpg',
      orderIndex: 8,
      published: true,
    },
    {
      kind: 'service',
      title: 'Заправка кондиционера',
      description: 'Проверка герметичности, вакуум, заправка фреоном и теста системы.',
      price: 'от 4 200 ₽',
      category: 'Кондиционер',
      imageUrl: '/placeholders/gallery-shopfloor.jpg',
      orderIndex: 9,
      published: true,
    },
    {
      kind: 'service',
      title: 'Шиномонтаж и балансировка',
      description: 'Сезонная перекидка, ремонт проколов, балансировка комплекта.',
      price: 'от 1 800 ₽',
      category: 'ТО',
      imageUrl: '/placeholders/gallery-alignment.jpg',
      orderIndex: 10,
      published: true,
    },
    {
      kind: 'service',
      title: 'Предпродажный осмотр',
      description: 'Комплексная проверка авто перед покупкой с письменным чек-листом.',
      price: 'от 3 000 ₽',
      category: 'Диагностика',
      imageUrl: '/placeholders/gallery-ready.jpg',
      orderIndex: 11,
      published: true,
    },
    {
      kind: 'service',
      title: 'ИИ-консультация + запись',
      description: 'Онлайн-разбор симптомов в чате с передачей отчёта мастеру и записью на пост.',
      price: 'бесплатно',
      category: 'Диагностика',
      imageUrl: '/placeholders/gallery-reception.jpg',
      orderIndex: 12,
      published: true,
    },
    {
      kind: 'work',
      title: 'Toyota Camry 2018 — вибрация при торможении',
      description: 'Диагностика тормозных дисков и суппортов, замена комплекта дисков и колодок.',
      problem: 'Вибрация в руль на скорости 70–90 км/ч при торможении',
      result: 'Биение устранено, тормозной путь в норме',
      term: '1 рабочий день',
      imageUrl: '/placeholders/works-brakes.jpg',
      orderIndex: 1,
      published: true,
    },
    {
      kind: 'work',
      title: 'Kia Rio 2019 — стук на кочках',
      description: 'Замена передних стоек и опор, контрольный осмотр рычагов.',
      problem: 'Глухой стук спереди на неровностях',
      result: 'Подвеска работает тихо, люфты устранены',
      term: '1–2 дня',
      imageUrl: '/placeholders/works-suspension.jpg',
      orderIndex: 2,
      published: true,
    },
    {
      kind: 'work',
      title: 'Volkswagen Polo 2020 — нестабильные обороты',
      description: 'Диагностика дроссельной заслонки, чистка, адаптация и тест-драйв.',
      problem: 'Плавающие обороты холостого хода',
      result: 'Работа двигателя стабилизирована',
      term: '1 рабочий день',
      imageUrl: '/placeholders/works-diagnostics.jpg',
      orderIndex: 3,
      published: true,
    },
    {
      kind: 'work',
      title: 'Hyundai Solaris 2017 — плановое ТО 90 тыс.',
      description: 'Масло, фильтры, свечи, промывка системы охлаждения.',
      problem: 'Регламентное обслуживание по пробегу',
      result: 'ТО выполнено, рекомендации по следующим узлам зафиксированы',
      term: 'в день обращения',
      imageUrl: '/placeholders/works-service.jpg',
      orderIndex: 4,
      published: true,
    },
    {
      kind: 'work',
      title: 'Skoda Octavia 2016 — рывки АКПП',
      description: 'Замена масла и фильтра АКПП, адаптация коробки.',
      problem: 'Рывки при переключении 2–3 передачи',
      result: 'Переключения стали плавными',
      term: '1 день',
      imageUrl: '/placeholders/works-transmission.jpg',
      orderIndex: 5,
      published: true,
    },
    {
      kind: 'work',
      title: 'Renault Duster 2015 — разряд АКБ',
      description: 'Поиск паразитного потребления, ремонт цепи освещения багажника.',
      problem: 'Аккумулятор садится за ночь',
      result: 'Утечка устранена, заряд держится',
      term: '4 часа',
      imageUrl: '/placeholders/works-electrics.jpg',
      orderIndex: 6,
      published: true,
    },
    {
      kind: 'work',
      title: 'BMW 320i 2014 — троение',
      description: 'Замена катушки, свечи, контрольный тест.',
      problem: 'Троение на холодную, Check Engine',
      result: 'Ход ровный, ошибка погашена',
      term: '1 день',
      imageUrl: '/placeholders/works-diagnostics.jpg',
      orderIndex: 7,
      published: true,
    },
    {
      kind: 'work',
      title: 'Mazda CX-5 — слабый холод кондиционера',
      description: 'Поиск утечки, вакуум, заправка фреоном.',
      problem: 'СК слабо холодит в жару',
      result: 'Температура воздуха в норме',
      term: 'в день обращения',
      imageUrl: '/placeholders/gallery-shopfloor.jpg',
      orderIndex: 8,
      published: true,
    },
    {
      kind: 'gallery',
      title: 'Зона приёма клиентов',
      description: 'Оформление заявки, консультация и передача ключей.',
      imageUrl: '/placeholders/gallery-reception.jpg',
      orderIndex: 1,
      published: true,
    },
    {
      kind: 'gallery',
      title: 'Пост на подъёмнике',
      description: 'Диагностика и ремонт ходовой, тормозов и выхлопа.',
      imageUrl: '/placeholders/gallery-bay.jpg',
      orderIndex: 2,
      published: true,
    },
    {
      kind: 'gallery',
      title: 'Цех обслуживания',
      description: 'Несколько постов параллельно — ТО и ремонт в одной смене.',
      imageUrl: '/placeholders/gallery-shopfloor.jpg',
      orderIndex: 3,
      published: true,
    },
    {
      kind: 'gallery',
      title: 'Стенд развал-схождения',
      description: 'Регулировка углов после работ по подвеске.',
      imageUrl: '/placeholders/gallery-alignment.jpg',
      orderIndex: 4,
      published: true,
    },
    {
      kind: 'gallery',
      title: 'Инструментальная зона',
      description: 'Оснастка для слесарных и электрических работ.',
      imageUrl: '/placeholders/gallery-tools.jpg',
      orderIndex: 5,
      published: true,
    },
    {
      kind: 'gallery',
      title: 'Авто после обслуживания',
      description: 'Выдача клиенту после диагностики и ремонта.',
      imageUrl: '/placeholders/gallery-ready.jpg',
      orderIndex: 6,
      published: true,
    },
    {
      kind: 'gallery',
      title: 'Диагностический пост',
      description: 'Компьютерная диагностика и работа с ошибками ЭБУ.',
      imageUrl: '/placeholders/works-diagnostics.jpg',
      orderIndex: 7,
      published: true,
    },
    {
      kind: 'gallery',
      title: 'Зона электрики',
      description: 'Поиск утечек и ремонт проводки.',
      imageUrl: '/placeholders/works-electrics.jpg',
      orderIndex: 8,
      published: true,
    },
  ];

  const prefixByKind = {
    service: '[CMS_SERVICE]',
    work: '[CMS_WORK]',
    gallery: '[CMS_GALLERY]',
  };

  await prisma.referenceMaterial.deleteMany({
    where: {
      OR: Object.values(prefixByKind).map((prefix) => ({ title: { startsWith: prefix } })),
    },
  });

  for (const item of cmsItems) {
    await prisma.referenceMaterial.create({
      data: {
        title: `${prefixByKind[item.kind]} ${item.title}`,
        body: JSON.stringify(item),
        categoryId: null,
      },
    });
  }

  const bookingsCount = await prisma.serviceBooking.count();
  const contactsCount = await prisma.contactSubmission.count();
  const jobsCount = await prisma.integrationJob.count();

  console.log(`Demo seed OK:
  client:  ${defaults.client.email} / ${defaults.client.password}
  manager: ${defaults.manager.email} / ${defaults.manager.password}
  admin:   ${defaults.admin.email} / ${defaults.admin.password}
  data: ${createdRequests} requests, ${bookingsCount} bookings, ${contactsCount} contacts, ${jobsCount} integration jobs
`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
