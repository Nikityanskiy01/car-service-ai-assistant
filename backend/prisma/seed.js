import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('Admin12345!', 10);

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
      passwordHash,
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
      passwordHash,
      fullName: 'Менеджер',
      phone: '+70000000002',
      role: 'MANAGER',
    },
  });

  console.log('Seed OK: admin@fox.local / manager@fox.local — пароль Admin12345!');
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
