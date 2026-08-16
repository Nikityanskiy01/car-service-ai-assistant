import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const prisma = new PrismaClient();

function demoPassword(envKey) {
  const fromEnv = String(process.env[envKey] || '').trim();
  if (!fromEnv) {
    throw new Error(`${envKey} is required to seed users (do not use hardcoded fallbacks)`);
  }
  return fromEnv;
}

async function main() {
  const accounts = [
    {
      email: process.env.DEMO_CLIENT_EMAIL || 'client@example.local',
      password: demoPassword('DEMO_CLIENT_PASSWORD'),
      fullName: 'Иван Петров',
      phone: '+79990000001',
      role: 'CLIENT',
    },
    {
      email: process.env.DEMO_MANAGER_EMAIL || 'manager@example.local',
      password: demoPassword('DEMO_MANAGER_PASSWORD'),
      fullName: 'Марина Орлова',
      phone: '+79990000002',
      role: 'MANAGER',
    },
    {
      email: process.env.DEMO_ADMIN_EMAIL || 'admin@example.local',
      password: demoPassword('DEMO_ADMIN_PASSWORD'),
      fullName: 'Админ Демо',
      phone: '+79990000003',
      role: 'ADMINISTRATOR',
    },
  ];
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
    const existing = await prisma.user.findUnique({ where: { email: account.email } });
    if (existing) {
      await prisma.user.update({
        where: { email: account.email },
        data: {
          fullName: account.fullName,
          phone: account.phone,
          role: account.role,
          blocked: false,
          emailVerifiedAt: existing.emailVerifiedAt || new Date(),
        },
      });
      continue;
    }
    const passwordHash = await bcrypt.hash(account.password, 12);
    await prisma.user.create({
      data: {
        email: account.email,
        passwordHash,
        fullName: account.fullName,
        phone: account.phone,
        role: account.role,
        emailVerifiedAt: new Date(),
      },
    });
  }

  console.log('Seed OK:\n' + accounts.map((a) => `  ${a.email} (${a.role})`).join('\n'));
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
