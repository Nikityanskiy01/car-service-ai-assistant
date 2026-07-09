import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const defaults = {
  client: { email: process.env.DEMO_CLIENT_EMAIL || 'client@example.local', password: process.env.DEMO_CLIENT_PASSWORD || '1q2w3e4r' },
  manager: { email: process.env.DEMO_MANAGER_EMAIL || 'manager@example.local', password: process.env.DEMO_MANAGER_PASSWORD || '1q2w3e4r5t' },
  admin: { email: process.env.DEMO_ADMIN_EMAIL || 'admin@example.local', password: process.env.DEMO_ADMIN_PASSWORD || '1q2w3e4r5t6y' },
};

async function upsertUser({ email, password, fullName, phone, role }) {
  const passwordHash = await bcrypt.hash(password, 10);
  return prisma.user.upsert({
    where: { email },
    update: { passwordHash, fullName, phone, role, blocked: false },
    create: { email, passwordHash, fullName, phone, role },
  });
}

async function main() {
  const [client, manager, admin] = await Promise.all([
    upsertUser({
      email: defaults.client.email,
      password: defaults.client.password,
      fullName: 'Демонстрационный клиент',
      phone: '+79990000001',
      role: 'CLIENT',
    }),
    upsertUser({
      email: defaults.manager.email,
      password: defaults.manager.password,
      fullName: 'Демонстрационный менеджер',
      phone: '+79990000002',
      role: 'MANAGER',
    }),
    upsertUser({
      email: defaults.admin.email,
      password: defaults.admin.password,
      fullName: 'Демонстрационный администратор',
      phone: '+79990000003',
      role: 'ADMINISTRATOR',
    }),
  ]);

  const categories = [
    { slug: 'diagnostics', name: 'Диагностика', description: 'Комплексная первичная диагностика' },
    { slug: 'brakes', name: 'Тормозная система', description: 'Проверка и обслуживание тормозной системы' },
    { slug: 'suspension', name: 'Подвеска', description: 'Диагностика и ремонт элементов подвески' },
  ];
  for (const category of categories) {
    await prisma.serviceCategory.upsert({
      where: { slug: category.slug },
      update: category,
      create: category,
    });
  }

  const session = await prisma.consultationSession.create({
    data: {
      clientId: client.id,
      status: 'COMPLETED',
      progressPercent: 100,
      confidencePercent: 78,
      costFromMinor: 6000,
      preliminaryNote:
        'Предварительный анализ указывает на возможный износ тормозных дисков. Требуется очная диагностика.',
      messages: {
        create: [
          { sender: 'USER', content: 'Toyota Camry 2018, вибрация при торможении, пробег 132000' },
          { sender: 'ASSISTANT', content: 'Уточните, вибрация проявляется на скорости выше 60 км/ч?' },
          { sender: 'USER', content: 'Да, чаще всего на скорости 70-90 км/ч' },
          {
            sender: 'ASSISTANT',
            content:
              'Предварительно вероятен износ тормозных дисков. Рекомендую диагностику тормозной системы в ближайшие 1-2 дня.',
          },
        ],
      },
      extracted: {
        create: {
          make: 'Toyota',
          model: 'Camry',
          year: 2018,
          mileage: 132000,
          symptoms: 'Вибрация при торможении',
          problemConditions: 'Скорость 70-90 км/ч',
        },
      },
      recommendations: {
        create: [
          { title: 'Износ тормозных дисков', probabilityPercent: 78 },
          { title: 'Неравномерный износ колодок', probabilityPercent: 55 },
        ],
      },
    },
  });

  const serviceRequest = await prisma.serviceRequest.create({
    data: {
      clientId: client.id,
      consultationSessionId: session.id,
      status: 'NEW',
      snapshotMake: 'Toyota',
      snapshotModel: 'Camry',
      snapshotSymptoms: 'Вибрация при торможении на скорости',
      followUpMessages: {
        create: [
          {
            authorId: manager.id,
            body: 'Добрый день. Предлагаем записаться на диагностику тормозной системы.',
          },
        ],
      },
      notifications: {
        create: {
          payload: JSON.stringify({ text: 'Новая заявка в демонстрационном режиме' }),
          status: 'SENT',
          attempts: 1,
        },
      },
    },
  });

  await prisma.serviceBooking.create({
    data: {
      clientId: client.id,
      serviceRequestId: serviceRequest.id,
      preferredAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
      status: 'PENDING',
      notes: 'Демонстрационная запись на диагностику',
    },
  });

  const cmsItems = [
    {
      kind: 'service',
      title: 'Диагностика тормозной системы',
      description: 'Проверка дисков, колодок и суппортов с фиксацией результата в карточке заявки.',
      price: 'от 2 500 ₽',
      category: 'Диагностика',
      orderIndex: 1,
      published: true,
    },
    {
      kind: 'work',
      title: 'Volkswagen Polo 2020 — нестабильные обороты',
      description: 'Диагностика дроссельной заслонки, чистка, адаптация и контрольный тест-драйв.',
      problem: 'Нестабильные обороты холостого хода',
      result: 'Работа двигателя стабилизирована',
      term: '1 рабочий день',
      orderIndex: 1,
      published: true,
    },
    {
      kind: 'gallery',
      title: 'Kia Rio 2019 — проверка подвески',
      description: 'Демонстрационный кейс с итоговой рекомендацией и записью на обслуживание.',
      imageUrl: '/assets/placeholders/gallery-05.svg',
      orderIndex: 1,
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

  console.log(
    `Demo seed OK:
  client: ${defaults.client.email}
  manager: ${defaults.manager.email}
  admin: ${defaults.admin.email}
  serviceRequestId: ${serviceRequest.id}`,
  );
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
