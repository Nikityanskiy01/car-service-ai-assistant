import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const accounts = [
  {
    email: 'client@example.local',
    password: 'Client-Demo-2026!',
    fullName: 'Иван Петров',
    phone: '+79990000001',
    role: 'CLIENT',
  },
  {
    email: 'manager@example.local',
    password: 'Manager-Demo-2026!',
    fullName: 'Марина Орлова',
    phone: '+79990000002',
    role: 'MANAGER',
  },
  {
    email: 'admin@example.local',
    password: 'Admin-Demo-2026!',
    fullName: 'Админ Демо',
    phone: '+79990000003',
    role: 'ADMINISTRATOR',
  },
];

async function main() {
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

  for (const account of accounts) {
    const passwordHash = await bcrypt.hash(account.password, 10);
    await prisma.user.upsert({
      where: { email: account.email },
      update: {
        passwordHash,
        fullName: account.fullName,
        phone: account.phone,
        role: account.role,
        blocked: false,
      },
      create: {
        email: account.email,
        passwordHash,
        fullName: account.fullName,
        phone: account.phone,
        role: account.role,
      },
    });
  }

  console.log(
    'Seed OK:\n' +
      accounts.map((a) => `  ${a.email} / ${a.password} (${a.role})`).join('\n'),
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
