import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const [hashLegacy, hashUserDemo, hashManagerDemo, hashAdminDemo] = await Promise.all([
    bcrypt.hash('Admin12345!', 10),
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
    where: { email: 'admin@fox.local' },
    update: {},
    create: {
      email: 'admin@fox.local',
      passwordHash: hashLegacy,
      fullName: 'Администратор',
      phone: '+70000000001',
      role: 'ADMINISTRATOR',
    },
  });

  await prisma.user.upsert({
    where: { email: 'manager@fox.local' },
    update: {},
    create: {
      email: 'manager@fox.local',
      passwordHash: hashLegacy,
      fullName: 'Менеджер',
      phone: '+70000000002',
      role: 'MANAGER',
    },
  });

  await prisma.user.upsert({
    where: { email: 'user@example.com' },
    update: {
      passwordHash: hashUserDemo,
      fullName: 'Тестовый клиент',
      phone: '+70000000100',
      role: 'CLIENT',
    },
    create: {
      email: 'user@example.com',
      passwordHash: hashUserDemo,
      fullName: 'Тестовый клиент',
      phone: '+70000000100',
      role: 'CLIENT',
    },
  });

  await prisma.user.upsert({
    where: { email: 'manager@example.com' },
    update: {
      passwordHash: hashManagerDemo,
      fullName: 'Менеджер (demo)',
      phone: '+70000000101',
      role: 'MANAGER',
    },
    create: {
      email: 'manager@example.com',
      passwordHash: hashManagerDemo,
      fullName: 'Менеджер (demo)',
      phone: '+70000000101',
      role: 'MANAGER',
    },
  });

  await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {
      passwordHash: hashAdminDemo,
      fullName: 'Администратор (demo)',
      phone: '+70000000102',
      role: 'ADMINISTRATOR',
    },
    create: {
      email: 'admin@example.com',
      passwordHash: hashAdminDemo,
      fullName: 'Администратор (demo)',
      phone: '+70000000102',
      role: 'ADMINISTRATOR',
    },
  });

  console.log(
    'Seed OK:\n' +
      '  user@example.com / 1q2w3e4r (клиент)\n' +
      '  manager@example.com / 1q2w3e4r5t (менеджер)\n' +
      '  admin@example.com / 1q2w3e4r5t6y (админ)\n' +
      '  admin@fox.local, manager@fox.local / Admin12345! (как раньше)',
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
