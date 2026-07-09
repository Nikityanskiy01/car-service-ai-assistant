import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const [hashUserDemo, hashManagerDemo, hashAdminDemo] = await Promise.all([
    bcrypt.hash('1q2w3e4r', 10),
    bcrypt.hash('1q2w3e4r5t', 10),
    bcrypt.hash('1q2w3e4r5t6y', 10),
  ]);

  await prisma.serviceCategory.upsert({
    where: { slug: 'diagnostics' },
    update: {},
    create: {
      name: 'Диагностика',
      slug: 'diagnostics',
      description: 'Компьютерная и визуальная диагностика',
    },
  });

  const scenarioCount = await prisma.consultationScenario.count();
  if (scenarioCount === 0) {
    await prisma.consultationScenario.create({
      data: {
        title: 'Базовый осмотр',
        description: 'Сценарий первичной консультации',
        active: true,
      },
    });
  }

  await prisma.user.upsert({
    where: { email: 'client@example.local' },
    update: {
      passwordHash: hashUserDemo,
      fullName: 'Тестовый клиент',
      phone: '+70000000100',
      role: 'CLIENT',
    },
    create: {
      email: 'client@example.local',
      passwordHash: hashUserDemo,
      fullName: 'Тестовый клиент',
      phone: '+70000000100',
      role: 'CLIENT',
    },
  });

  await prisma.user.upsert({
    where: { email: 'manager@example.local' },
    update: {
      passwordHash: hashManagerDemo,
      fullName: 'Тестовый менеджер',
      phone: '+70000000101',
      role: 'MANAGER',
    },
    create: {
      email: 'manager@example.local',
      passwordHash: hashManagerDemo,
      fullName: 'Тестовый менеджер',
      phone: '+70000000101',
      role: 'MANAGER',
    },
  });

  await prisma.user.upsert({
    where: { email: 'admin@example.local' },
    update: {
      passwordHash: hashAdminDemo,
      fullName: 'Тестовый администратор',
      phone: '+70000000102',
      role: 'ADMINISTRATOR',
    },
    create: {
      email: 'admin@example.local',
      passwordHash: hashAdminDemo,
      fullName: 'Тестовый администратор',
      phone: '+70000000102',
      role: 'ADMINISTRATOR',
    },
  });

  console.log(
    'Seed OK:\n' +
      '  client@example.local / 1q2w3e4r (клиент)\n' +
      '  manager@example.local / 1q2w3e4r5t (менеджер)\n' +
      '  admin@example.local / 1q2w3e4r5t6y (админ)',
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
