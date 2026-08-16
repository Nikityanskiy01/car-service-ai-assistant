import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { seedDemoInboxNotifications } from './lib/demoInboxNotifications.js';
import { seedAdminInbox, seedManagerInbox } from './lib/demoStaffInbox.js';
import {
  CRM_CLIENTS,
  EXTRA_CMS_BLOCKS,
  EXTRA_SCENARIOS,
  LEGACY_DEMO_EMAILS,
  buildExtraBookings,
  buildExtraContacts,
  buildFleetCases,
  buildFleetVehicles,
  buildOrphanConsultations,
} from './lib/demoOpsCatalog.js';
import { hashGuestToken } from '../src/lib/guestToken.js';

dotenv.config();

const prisma = new PrismaClient();

function demoPassword(envKey) {
  const fromEnv = String(process.env[envKey] || '').trim();
  if (!fromEnv) {
    throw new Error(`${envKey} is required to seed demo users (do not use hardcoded fallbacks)`);
  }
  return fromEnv;
}

const defaults = {
  client: {
    email: process.env.DEMO_CLIENT_EMAIL || 'client@example.local',
    password: demoPassword('DEMO_CLIENT_PASSWORD'),
  },
  manager: {
    email: process.env.DEMO_MANAGER_EMAIL || 'manager@example.local',
    password: demoPassword('DEMO_MANAGER_PASSWORD'),
  },
  admin: {
    email: process.env.DEMO_ADMIN_EMAIL || 'admin@example.local',
    password: demoPassword('DEMO_ADMIN_PASSWORD'),
  },
};

function hoursFromNow(h) {
  return new Date(Date.now() + h * 3600_000);
}

function hoursAgo(h) {
  return new Date(Date.now() - h * 3600_000);
}

async function upsertUser({ email, password, fullName, phone, role, extra = {} }) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return prisma.user.update({
      where: { email },
      data: {
        fullName,
        phone,
        role,
        blocked: extra.blocked ?? false,
        city: extra.city ?? existing.city,
        telegram: extra.telegram ?? existing.telegram,
        emailVerifiedAt: existing.emailVerifiedAt || new Date(),
      },
    });
  }
  const passwordHash = await bcrypt.hash(password, 12);
  return prisma.user.create({
    data: {
      email,
      passwordHash,
      fullName,
      phone,
      role,
      blocked: extra.blocked ?? false,
      city: extra.city || null,
      telegram: extra.telegram || null,
      emailVerifiedAt: new Date(),
    },
  });
}

async function upsertCrmClient(spec) {
  return upsertUser({
    email: spec.email,
    password: crypto.randomBytes(32).toString('hex'),
    fullName: spec.fullName,
    phone: spec.phone,
    role: 'CLIENT',
    extra: { city: spec.city, telegram: spec.telegram, blocked: Boolean(spec.blocked) },
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

  await prisma.consentEvent.deleteMany();
  await prisma.serviceBookingAuditLog.deleteMany();
  await prisma.serviceBooking.deleteMany();
  await prisma.inboxNotificationDelivery.deleteMany();
  await prisma.inboxNotification.deleteMany();
  await prisma.serviceRequestCompletionDocument.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.requestFollowUpMessage.deleteMany();
  await prisma.vehicleServiceRecord.deleteMany();
  await prisma.clientVehicleExclusion.deleteMany();
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
  await prisma.clientVehicle.deleteMany();
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
  diagnosis,
  assignedManagerId = null,
  firstResponseAt = null,
  vehicleId = null,
  feedback = null,
}) {
  const session = await prisma.consultationSession.create({
    data: {
      clientId: clientId || null,
      vehicleId: vehicleId || null,
      guestName: guest?.name || null,
      guestPhone: guest?.phone || null,
      guestToken: guest ? hashGuestToken(`demo-guest-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`) : null,
      status: status === 'NEW' || status === 'IN_PROGRESS' ? 'COMPLETED' : status === 'CANCELLED' ? 'ABANDONED' : 'COMPLETED',
      progressPercent,
      confidencePercent,
      costFromMinor,
      preliminaryNote,
      createdAt: createdAt || undefined,
      flowState: {
        stage: progressPercent >= 100 ? 'COMPLETED' : 'CLARIFYING',
        ...(diagnosis
          ? {
              diagnosis: {
                summary: diagnosis.summary,
                urgency: diagnosis.urgency || 'medium',
                confidence: diagnosis.confidence ?? (confidencePercent != null ? confidencePercent / 100 : null),
                estimated_cost_from: diagnosis.estimated_cost_from ?? costFromMinor ?? null,
                recommended_checks: diagnosis.recommended_checks || [],
                probable_causes: diagnosis.probable_causes || recommendations.map((r) => r.title),
                status: 'SUCCESS',
                analysis_available: true,
                reason: null,
                disclaimer:
                  'Результат предварительный и не заменяет техническую диагностику автомобиля специалистом.',
              },
              recommended_checks: diagnosis.recommended_checks || [],
            }
          : {}),
      },
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

  const respondedAt =
    firstResponseAt ||
    (followUps.length && createdAt ? new Date(createdAt.getTime() + 12 * 60_000) : followUps.length ? hoursAgo(0.2) : null);

  const statusLogs = [{ actorId: managerId, fromStatus: null, toStatus: 'NEW', createdAt: createdAt || undefined }];
  if (status !== 'NEW') {
    statusLogs.push({
      actorId: assignedManagerId || managerId,
      fromStatus: 'NEW',
      toStatus: status,
      createdAt: respondedAt || createdAt || undefined,
    });
  }

  const request = await prisma.serviceRequest.create({
    data: {
      clientId: clientId || null,
      vehicleId: vehicleId || null,
      guestName: guest?.name || null,
      guestPhone: guest?.phone || null,
      guestEmail: guest?.email || null,
      consultationSessionId: session.id,
      status,
      snapshotMake: make,
      snapshotModel: model,
      snapshotSymptoms: symptoms,
      assignedManagerId: assignedManagerId || null,
      firstResponseAt: respondedAt,
      createdAt: createdAt || undefined,
      followUpMessages: followUps.length
        ? {
            create: followUps.map((body) => ({ authorId: managerId, body })),
          }
        : undefined,
      statusLogs: { create: statusLogs },
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
        vehicleId: vehicleId || null,
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

  if (feedback) {
    const fb = await prisma.consultationFeedback.create({
      data: {
        sessionId: session.id,
        managerId: feedback.managerId || managerId,
        verdict: feedback.verdict,
        actualCause: feedback.actualCause || null,
        worksDone: feedback.worksDone || null,
        repairAmountMinor: feedback.repairAmountMinor ?? null,
        workOrderNumber: feedback.workOrderNumber || null,
        repairCompletedAt: feedback.repairCompletedAt || null,
      },
    });
    if (vehicleId && clientId && feedback.worksDone) {
      await prisma.vehicleServiceRecord.create({
        data: {
          vehicleId,
          clientId,
          performedAt: feedback.repairCompletedAt || hoursAgo(8),
          mileageKm: mileage || null,
          title: feedback.worksDone.slice(0, 120),
          category: 'other',
          worksDone: feedback.worksDone,
          workOrderNumber: feedback.workOrderNumber || null,
          amountMinor: feedback.repairAmountMinor ?? null,
          source: 'manager_feedback',
          serviceRequestId: request.id,
          consultationFeedbackId: fb.id,
          createdById: feedback.managerId || managerId,
        },
      });
    }
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

  await prisma.refreshToken.deleteMany({
    where: { user: { email: { in: LEGACY_DEMO_EMAILS } } },
  });
  await prisma.user.deleteMany({
    where: { email: { in: LEGACY_DEMO_EMAILS } },
  });

  const crmUsers = {};
  for (const spec of CRM_CLIENTS) {
    crmUsers[spec.key] = await upsertCrmClient(spec);
  }

  const people = {
    client,
    manager,
    admin,
    managerId: manager.id,
    anna: crmUsers.anna,
    sergey: crmUsers.sergey,
    maria: crmUsers.maria,
    dmitry: crmUsers.dmitry,
    elena: crmUsers.elena,
    oleg: crmUsers.oleg,
  };

  const vehicles = {};
  for (const spec of buildFleetVehicles(people)) {
    const { key, ...data } = spec;
    vehicles[key] = await prisma.clientVehicle.create({ data });
  }
  const vehicleByCar = new Map(
    Object.values(vehicles).map((row) => [`${row.make}|${row.model}`, row]),
  );

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
        { title: 'Деформация передних тормозных дисков — вибрация руля на 70–90 км/ч', probabilityPercent: 78 },
        { title: 'Неравномерный износ колодок и заедание направляющих суппорта', probabilityPercent: 55 },
        { title: 'Люфт ступичного подшипника или рулевых наконечников (реже)', probabilityPercent: 28 },
      ],
      diagnosis: {
        summary:
          'По Toyota Camry 2018 предварительный ориентир — биение передних тормозных дисков: вибрация в руле на 70–90 км/ч типична после перегрева. В сервисе снимем колёса, промерим биение дисков и состояние колодок. Ехать можно, но без резких торможений до проверки.',
        urgency: 'high',
        confidence: 0.78,
        estimated_cost_from: 2800,
        probable_causes: [
          'Деформация передних тормозных дисков — вибрация руля на 70–90 км/ч',
          'Неравномерный износ колодок и заедание направляющих суппорта',
          'Люфт ступичного подшипника или рулевых наконечников (реже)',
        ],
        recommended_checks: [
          'Снять колёса, осмотреть диски на синеву, бороздки и кромку',
          'Индикатором проверить биение диска на ступице',
          'Оценить толщину колодок и ход направляющих суппорта',
        ],
      },
      messages: [
        { sender: 'USER', content: 'Toyota Camry 2018, 132000 км. При торможении вибрация в руль.' },
        { sender: 'ASSISTANT', content: 'Вибрация появляется на высокой скорости или в любом режиме?' },
        { sender: 'USER', content: 'Чаще на 70–90 км/ч.' },
        { sender: 'ASSISTANT', content: 'Предварительно — биение передних дисков. В сервисе снимем колёса и промерим биение. Можно сохранить отчёт и оформить заявку.' },
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
        { title: 'Износ стойки стабилизатора справа — глухой стук на мелких неровностях', probabilityPercent: 71 },
        { title: 'Опора переднего амортизатора', probabilityPercent: 48 },
        { title: 'Люфт шаровой опоры или рулевого наконечника', probabilityPercent: 36 },
      ],
      diagnosis: {
        summary:
          'По Kia Rio 2019 глухой стук спереди справа на кочках чаще всего даёт стойка стабилизатора или опора амортизатора на пробеге около 100 тыс. На подъёмнике проверим люфты монтажкой и состояние опор. До визита избегайте ям на скорости.',
        urgency: 'medium',
        confidence: 0.71,
        estimated_cost_from: 3000,
        probable_causes: [
          'Износ стойки стабилизатора справа — глухой стук на мелких неровностях',
          'Опора переднего амортизатора',
          'Люфт шаровой опоры или рулевого наконечника',
        ],
        recommended_checks: [
          'На подъёмнике проверить люфт стойки и втулки стабилизатора',
          'Осмотреть верхнюю опору амортизатора под нагрузкой',
          'Проверить шаровые и рулевые наконечники монтажкой',
        ],
      },
      messages: [
        { sender: 'USER', content: 'Kia Rio 2019, стук спереди на кочках, пробег 98000.' },
        { sender: 'ASSISTANT', content: 'Стук глухой или звонкий? С одной стороны или с обеих?' },
        { sender: 'USER', content: 'Глухой, больше справа.' },
        { sender: 'ASSISTANT', content: 'Похоже на стойку стабилизатора или опору амортизатора справа. В сервисе проверим люфты на подъёмнике. Можно оформить заявку.' },
      ],
      followUps: [
        'Приняли заявку в работу. Нужны фото/видео стука, если есть.',
        'Предлагаем слот сегодня после 17:00 или завтра утром.',
      ],
      booking: {
        preferredAt: hoursFromNow(4),
        status: 'CONFIRMED',
        notes: 'Проверка подвески',
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
      recommendations: [
        { title: 'Замена масла ДВС и масляного фильтра по регламенту 90 тыс.', probabilityPercent: 95 },
        { title: 'Замена воздушного и салонного фильтров', probabilityPercent: 88 },
        { title: 'Свечи зажигания и контроль тормозов/жидкостей', probabilityPercent: 70 },
      ],
      diagnosis: {
        summary:
          'По Hyundai Solaris 2017 на 90 тыс. км это регламентное ТО, а не неисправность: масло ДВС, масляный, воздушный и салонный фильтры, проверка свечей и тормозов. В сервисе сверим сервисную книжку и сразу соберём чек-лист сопутствующих работ.',
        urgency: 'low',
        confidence: 0.9,
        estimated_cost_from: 5000,
        probable_causes: [
          'Замена масла ДВС и масляного фильтра по регламенту 90 тыс.',
          'Замена воздушного и салонного фильтров',
          'Свечи зажигания и контроль тормозов/жидкостей',
        ],
        recommended_checks: [
          'Сверить регламент производителя по пробегу и сроку',
          'Оценить состояние фильтров, свечей и колодок',
          'Проверить уровни жидкостей и наличие течей',
        ],
      },
      messages: [
        { sender: 'USER', content: 'Hyundai Solaris 2017, нужно ТО на 90 тысяч.' },
        { sender: 'ASSISTANT', content: 'Подтвердите: масло ДВС, масляный/воздушный/салонный фильтры, свечи?' },
        { sender: 'USER', content: 'Да, полный комплект.' },
        { sender: 'ASSISTANT', content: 'Регламент на 90 тыс.: масло, фильтры, проверка свечей и тормозов. Ориентир по работам готов — можно записаться в день обращения.' },
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
        { title: 'Загрязнение дроссельной заслонки — плавают обороты без Check Engine', probabilityPercent: 66 },
        { title: 'Подсос воздуха на впуске', probabilityPercent: 44 },
        { title: 'Сбой адаптации ХХ / датчик положения дросселя', probabilityPercent: 40 },
      ],
      diagnosis: {
        summary:
          'По VW Polo 2020 плавающие холостые без Check Engine чаще всего даёт загрязнённый дроссель или подсос воздуха. Считаем параметры ХХ сканером, проверяем впуск и при необходимости чистим дроссель с адаптацией.',
        urgency: 'medium',
        confidence: 0.66,
        estimated_cost_from: 2500,
        probable_causes: [
          'Загрязнение дроссельной заслонки — плавают обороты без Check Engine',
          'Подсос воздуха на впуске',
          'Сбой адаптации ХХ / датчик положения дросселя',
        ],
        recommended_checks: [
          'Считать параметры ХХ, коррекции смеси и положение дросселя',
          'Проверить подсос на впуске (дымогенератор или аэрозоль)',
          'Осмотреть и при необходимости промыть дроссельный узел, сделать адаптацию',
        ],
      },
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
      feedback: {
        managerId: manager.id,
        verdict: 'CORRECT',
        actualCause: 'Загрязнение дроссельной заслонки',
        worksDone: 'Чистка дросселя, адаптация ХХ, тест-драйв',
        repairAmountMinor: 4800,
        workOrderNumber: 'ЗН-10210',
        repairCompletedAt: hoursAgo(18),
      },
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
        { title: 'Старое масло АКПП/DSG — рывки 2–3 после прогрева, масло не меняли', probabilityPercent: 62 },
        { title: 'Грязный фильтр гидроблока / соленоиды', probabilityPercent: 38 },
        { title: 'Механика сцепления DSG (если подтвердится тип коробки)', probabilityPercent: 28 },
      ],
      diagnosis: {
        summary:
          'По Skoda Octavia 2016 рывки 2–3 на прогретой коробке при пробеге 154 тыс. и неизвестном интервале масла чаще всего лечатся сервисом АКПП/DSG: масло, фильтр, адаптация. В сервисе считаем ошибки коробки и оценим состояние ATF до разбора мехатроника.',
        urgency: 'medium',
        confidence: 0.62,
        estimated_cost_from: 3500,
        probable_causes: [
          'Старое масло АКПП/DSG — рывки 2–3 после прогрева, масло не меняли',
          'Грязный фильтр гидроблока / соленоиды',
          'Механика сцепления DSG (если подтвердится тип коробки)',
        ],
        recommended_checks: [
          'Считать ошибки АКПП и параметры температуры/пробуксовки',
          'Оценить уровень и состояние ATF, наличие течей',
          'Тест-драйв по передачам 2–3 после прогрева, затем решение по замене масла и адаптации',
        ],
      },
      messages: [
        { sender: 'USER', content: 'Octavia 2016 DSG/АКПП, рывки при переключении 2-3.' },
        { sender: 'ASSISTANT', content: 'Когда меняли масло в коробке в последний раз?' },
        { sender: 'USER', content: 'Не помню, возможно никогда.' },
        { sender: 'ASSISTANT', content: 'С высокой вероятностью поможет сервис АКПП: масло давно не меняли. Считаем ошибки коробки и смотрим ATF, затем решим по замене и адаптации.' },
      ],
      followUps: ['Ждём вас на диагностику АКПП. Не прогревайте агрессивно до записи.'],
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
        { title: 'Паразитная утечка тока — нештатная магнитола, АКБ садится за ночь', probabilityPercent: 58 },
        { title: 'Износ аккумулятора (возраст ~3 года, ёмкость ниже нормы)', probabilityPercent: 45 },
        { title: 'Слабый заряд генератора или окисление клемм', probabilityPercent: 30 },
      ],
      diagnosis: {
        summary:
          'По Renault Duster 2015 утренняя разрядка при АКБ ~3 лет и нештатной магнитоле — либо утечка тока, либо износ батареи. Сначала тест ёмкости АКБ и замер тока покоя, затем генератор и клеммы. Не оставляйте авто с включёнными потребителями до проверки.',
        urgency: 'medium',
        confidence: 0.58,
        estimated_cost_from: 2500,
        probable_causes: [
          'Паразитная утечка тока — нештатная магнитола, АКБ садится за ночь',
          'Износ аккумулятора (возраст ~3 года, ёмкость ниже нормы)',
          'Слабый заряд генератора или окисление клемм',
        ],
        recommended_checks: [
          'Тест ёмкости АКБ и напряжение под нагрузкой',
          'Замер тока утечки при выключенном зажигании',
          'Проверка зарядки генератора и состояния клемм/массы',
        ],
      },
      messages: [
        { sender: 'USER', content: 'Duster 2015, утром АКБ разряжена.' },
        { sender: 'ASSISTANT', content: 'Аккумулятору сколько лет? Есть доп. оборудование?' },
        { sender: 'USER', content: 'АКБ года 3, магнитола нештатная.' },
      ],
      followUps: [],
      booking: null,
      createdAt: hoursAgo(2),
      assigned: false,
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
      preliminaryNote: 'Клиент отменил запись.',
      recommendations: [{ title: 'Износ ступичного подшипника справа — гул растёт со скоростью и в повороте влево', probabilityPercent: 70 }],
      diagnosis: {
        summary:
          'По Lada Vesta 2021 гул справа на скорости, усиливающийся в повороте влево, типичен для правого ступичного подшипника. На подъёмнике проверим люфт колеса; до визита не разгоняйтесь на трассе, если гул уже громкий.',
        urgency: 'medium',
        confidence: 0.7,
        estimated_cost_from: 3000,
        probable_causes: [
          'Износ ступичного подшипника справа — гул растёт со скоростью и в повороте влево',
          'Неравномерный износ шины или дисбаланс колеса',
        ],
        recommended_checks: [
          'Проверить люфт колеса на подъёмнике в двух плоскостях',
          'Сравнить температуру ступиц после пробега',
          'Исключить гул трансмиссии и шины',
        ],
      },
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
        { title: 'Катушка зажигания — троение на холодную, Check Engine', probabilityPercent: 64 },
        { title: 'Износ свечей на пробеге 200 тыс.', probabilityPercent: 50 },
        { title: 'Форсунка / подсос воздуха (если катушки чистые)', probabilityPercent: 32 },
      ],
      diagnosis: {
        summary:
          'По BMW 320i 2014 троение на холодную с Check Engine на 201 тыс. км чаще всего даёт катушка или свеча конкретного цилиндра. В сервисе считаем ошибки и misfire-счётчики, затем перестановкой катушек подтвердим цилиндр. До визита лучше не крутить мотор в отсечку.',
        urgency: 'medium',
        confidence: 0.64,
        estimated_cost_from: 2500,
        probable_causes: [
          'Катушка зажигания — троение на холодную, Check Engine',
          'Износ свечей на пробеге 200 тыс.',
          'Форсунка / подсос воздуха (если катушки чистые)',
        ],
        recommended_checks: [
          'Считать ошибки ЭБУ и счётчики пропусков по цилиндрам',
          'Осмотреть свечи, переставить катушки между цилиндрами',
          'При необходимости проверить подсос и работу форсунок',
        ],
      },
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
      assigned: false,
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
      recommendations: [
        { title: 'Недостаток фреона из-за микроутечки контура', probabilityPercent: 55 },
        { title: 'Загрязнение конденсатора (радиатора кондиционера)', probabilityPercent: 38 },
        { title: 'Слабая работа вентилятора или забит салонный фильтр', probabilityPercent: 28 },
      ],
      diagnosis: {
        summary:
          'По Mazda CX-5 2018 слабый холод при жаре и заправке год назад почти всегда означает утечку фреона или грязный конденсатор, а не «просто дозаправить и забыть». В сервисе замерим давления, поищем утечку и проверим конденсатор с вентиляторами.',
        urgency: 'low',
        confidence: 0.55,
        estimated_cost_from: 3500,
        probable_causes: [
          'Недостаток фреона из-за микроутечки контура',
          'Загрязнение конденсатора (радиатора кондиционера)',
          'Слабая работа вентилятора или забит салонный фильтр',
        ],
        recommended_checks: [
          'Замер давления фреона на высокой и низкой стороне',
          'Поиск утечки течеискателем, осмотр трубок и соединений',
          'Продувка конденсатора и проверка вентиляторов, салонный фильтр',
        ],
      },
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
        { title: 'Прокладка клапанной крышки — пятно после ночной стоянки, уровень чуть падает', probabilityPercent: 72 },
        { title: 'Сальник коленвала / стык с коробкой', probabilityPercent: 35 },
        { title: 'Пробка поддона или корпус масляного фильтра', probabilityPercent: 22 },
      ],
      diagnosis: {
        summary:
          'По Nissan Qashqai 2013 утреннее масляное пятно без запаха гари чаще всего даёт прокладка клапанной крышки. На подъёмнике локализуем течь, помоем агрегат при необходимости. Уровень контролировать до визита, не доливать «на глаз» сверх метки.',
        urgency: 'medium',
        confidence: 0.72,
        estimated_cost_from: 3200,
        probable_causes: [
          'Прокладка клапанной крышки — пятно после ночной стоянки, уровень чуть падает',
          'Сальник коленвала / стык с коробкой',
          'Пробка поддона или корпус масляного фильтра',
        ],
        recommended_checks: [
          'Осмотр на подъёмнике: откуда именно капает',
          'Проверка уровня масла, пробки и фильтра',
          'При необходимости мойка агрегата и контрольный пробег',
        ],
      },
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
      feedback: {
        managerId: manager.id,
        verdict: 'PARTIAL',
        actualCause: 'Прокладка клапанной крышки, плюс запотевание сальника распредвала',
        worksDone: 'Замена прокладки клапанной крышки, контроль сальника',
        repairAmountMinor: 13200,
        workOrderNumber: 'ЗН-10188',
        repairCompletedAt: hoursAgo(68),
      },
    },
  ];

  let createdRequests = 0;
  const createdRequestRows = [];

  async function seedCase(item) {
    const assignedManagerId =
      item.assigned === false ? null : (item.assignedManagerId ?? manager.id);
    const car = vehicleByCar.get(`${item.make}|${item.model}`);
    const vehicleId = item.vehicleId || car?.id || null;
    const row = await createCase({
      ...item,
      managerId: manager.id,
      assignedManagerId,
      vehicleId,
    });
    createdRequestRows.push(row.request);
    createdRequests += 1;
    return row;
  }

  for (const item of cases) {
    await seedCase(item);
  }

  for (const item of buildFleetCases({ hoursAgo, hoursFromNow, people, vehicles })) {
    await seedCase(item);
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
      notes: 'Уже в сервисе',
    },
  ];
  for (const b of extraBookings) {
    await prisma.serviceBooking.create({ data: b });
  }
  for (const b of buildExtraBookings({ hoursAgo, hoursFromNow, people, vehicles })) {
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

  for (const session of buildOrphanConsultations({ hoursAgo, clientId: client.id })) {
    const { messages, extracted, ...rest } = session;
    await prisma.consultationSession.create({
      data: {
        ...rest,
        guestToken: rest.guestPhone
          ? hashGuestToken(`demo-orphan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
          : null,
        messages: { create: messages },
        extracted: extracted ? { create: extracted } : undefined,
      },
    });
  }

  for (const sc of EXTRA_SCENARIOS) {
    let row = await prisma.consultationScenario.findFirst({ where: { title: sc.title } });
    if (!row) {
      row = await prisma.consultationScenario.create({
        data: { title: sc.title, description: sc.description, active: true },
      });
    } else {
      await prisma.consultationQuestion.deleteMany({ where: { scenarioId: row.id } });
      await prisma.hint.deleteMany({ where: { scenarioId: row.id } });
      await prisma.consultationScenario.update({
        where: { id: row.id },
        data: { description: sc.description, active: true },
      });
    }
    await prisma.consultationQuestion.createMany({
      data: sc.questions.map((text, order) => ({ scenarioId: row.id, text, order })),
    });
    await prisma.hint.createMany({
      data: sc.hints.map((text, order) => ({ scenarioId: row.id, text, order })),
    });
  }

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
  const convertedRequest = createdRequestRows.find((row) => String(row.snapshotModel || '').includes('Tiggo'));
  for (const c of buildExtraContacts({ hoursAgo, convertedRequestId: convertedRequest?.id || null })) {
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
      content: 'Ответ ассистента информационный и не заменяет осмотр в сервисе.',
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
  for (const block of [...blocks, ...EXTRA_CMS_BLOCKS]) {
    const row = await prisma.siteContentBlock.create({ data: block });
    await prisma.siteContentVersion.create({
      data: {
        blockId: row.id,
        content: block.content,
        note: block.isPublished ? 'Демо-версия' : 'Черновик, не публиковать',
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
      {
        actorId: admin.id,
        action: 'USER_BLOCK',
        entityType: 'user',
        entityId: people.oleg.id,
        payloadJson: { email: people.oleg.email, reason: 'Демо: профиль заблокирован' },
      },
      {
        actorId: admin.id,
        action: 'CMS_SITE_ITEM_UPDATE',
        entityType: 'site_content_block',
        entityId: 'home.promo.brakes',
        payloadJson: { published: false },
      },
      {
        actorId: manager.id,
        action: 'REQUEST_ASSIGN',
        entityType: 'service_request',
        entityId: createdRequestRows.find((row) => row.snapshotModel === 'A6')?.id || 'demo',
        payloadJson: { assignedTo: manager.fullName },
      },
      {
        actorId: admin.id,
        action: 'SETTINGS_UPDATE',
        entityType: 'site_settings',
        entityId: 'default',
        payloadJson: { note: 'Проверены часы работы и эвакуатор' },
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

  const moysklad = await prisma.integrationConnection.create({
    data: {
      name: '[DEMO] МойСклад',
      provider: 'MOYSKLAD',
      versionLabel: 'remap1.2',
      mode: 'api',
      status: 'UNAVAILABLE',
      enabled: true,
      lastErrorCode: 'UPSTREAM_DOWN',
      lastErrorMessage: 'Таймаут склада, 3 задания в dead-letter',
      capabilitiesJson: { stock: true, invoices: true },
      configJson: { account: 'demo-autoservice' },
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
      {
        connectionId: moysklad.id,
        eventType: 'SYNC_OUTBOUND',
        entityType: 'service_request',
        entityId: 'demo-req-stock-1',
        idempotencyKey: `demo-job-dead-${Date.now()}`,
        status: 'DEAD_LETTER',
        attemptCount: 8,
        lastErrorCode: 'UPSTREAM_DOWN',
        lastErrorMessage: 'Connection timed out',
        payloadJson: { action: 'reserve_parts' },
      },
      {
        connectionId: moysklad.id,
        eventType: 'SYNC_OUTBOUND',
        entityType: 'service_request',
        entityId: 'demo-req-stock-2',
        idempotencyKey: `demo-job-dead-2-${Date.now()}`,
        status: 'DEAD_LETTER',
        attemptCount: 8,
        lastErrorCode: 'UPSTREAM_DOWN',
        lastErrorMessage: 'Connection timed out',
        payloadJson: { action: 'reserve_parts' },
      },
      {
        connectionId: bitrix.id,
        eventType: 'SYNC_OUTBOUND',
        entityType: 'service_request',
        entityId: createdRequestRows[0]?.id || 'demo-req-live',
        idempotencyKey: `demo-job-ok-2-${Date.now()}`,
        status: 'SUCCEEDED',
        attemptCount: 1,
        payloadJson: { action: 'upsert_deal' },
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
  await prisma.integrationConflict.create({
    data: {
      connectionId: amocrm.id,
      entityType: 'contact',
      internalEntityId: people.anna.id,
      externalEntityId: 'AMO-C-4412',
      field: 'phone',
      localValue: people.anna.phone,
      externalValue: '+79990000000',
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
      description: 'Онлайн-разбор симптомов в чате с передачей отчёта мастеру и записью в сервис.',
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
      title: 'Подъёмник в сервисе',
      description: 'Диагностика и ремонт ходовой, тормозов и выхлопа.',
      imageUrl: '/placeholders/gallery-bay.jpg',
      orderIndex: 2,
      published: true,
    },
    {
      kind: 'gallery',
      title: 'Цех обслуживания',
      description: 'Несколько авто параллельно — ТО и ремонт в одной смене.',
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
      title: 'Диагностика в сервисе',
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

  const clientBookings = await prisma.serviceBooking.findMany({
    where: { clientId: client.id },
    orderBy: { preferredAt: 'asc' },
    select: { id: true, status: true, preferredAt: true },
  });
  const clientRequests = await prisma.serviceRequest.findMany({
    where: { clientId: client.id },
    orderBy: { createdAt: 'desc' },
    select: { id: true, status: true },
  });
  const inboxCount = await seedDemoInboxNotifications(prisma, {
    userId: client.id,
    bookings: clientBookings,
    requests: clientRequests,
  });

  const managerRequest = createdRequestRows.find((row) => row.assignedManagerId === manager.id);
  const managerBooking = await prisma.serviceBooking.findFirst({
    where: { status: 'ARRIVED' },
    select: { id: true },
  });
  const managerInbox = await seedManagerInbox(prisma, {
    userId: manager.id,
    requestId: managerRequest?.id,
    bookingId: managerBooking?.id,
  });
  const adminInbox = await seedAdminInbox(prisma, { userId: admin.id });

  const assignedToManager = createdRequestRows.filter((row) => row.assignedManagerId === manager.id).length;
  const unassigned = createdRequestRows.filter((row) => !row.assignedManagerId).length;
  const crmClients = CRM_CLIENTS.length;

  console.log(`Demo seed OK:
  client:  ${defaults.client.email}
  manager: ${defaults.manager.email}
  admin:   ${defaults.admin.email}
  data: ${createdRequests} requests (${assignedToManager} у менеджера, ${unassigned} без ответственного), ${bookingsCount} bookings, ${contactsCount} contacts, ${jobsCount} integration jobs
  inbox: client ${inboxCount}, manager ${managerInbox}, admin ${adminInbox}
  crm clients: ${crmClients} доп. (логины демо-аккаунтов не менялись)
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
