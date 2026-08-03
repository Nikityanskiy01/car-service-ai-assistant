import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const users = [
  {
    email: process.env.PROD_ADMIN_EMAIL,
    password: process.env.PROD_ADMIN_PASSWORD,
    fullName: 'Администратор',
    phone: '+70000000001',
    role: 'ADMINISTRATOR',
  },
  {
    email: process.env.PROD_MANAGER_EMAIL,
    password: process.env.PROD_MANAGER_PASSWORD,
    fullName: 'Менеджер',
    phone: '+70000000002',
    role: 'MANAGER',
  },
  {
    email: process.env.PROD_CLIENT_EMAIL,
    password: process.env.PROD_CLIENT_PASSWORD,
    fullName: 'Клиент',
    phone: '+70000000003',
    role: 'CLIENT',
  },
];

for (const u of users) {
  if (!u.email || !u.password) throw new Error(`Missing credentials for ${u.role}`);
  if (u.password.length < 12) throw new Error(`Weak password for ${u.email}`);
}

async function main() {
  await prisma.refreshToken.deleteMany();
  for (const u of users) {
    const passwordHash = await bcrypt.hash(u.password, 12);
    await prisma.user.upsert({
      where: { email: u.email.toLowerCase() },
      update: {
        passwordHash,
        fullName: u.fullName,
        phone: u.phone,
        role: u.role,
        blocked: false,
        emailVerifiedAt: new Date(),
      },
      create: {
        email: u.email.toLowerCase(),
        passwordHash,
        fullName: u.fullName,
        phone: u.phone,
        role: u.role,
        emailVerifiedAt: new Date(),
      },
    });
    console.log(`OK ${u.role}: ${u.email}`);
  }
  // Remove legacy demo emails if present
  const removed = await prisma.user.deleteMany({
    where: {
      email: {
        in: ['client@example.local', 'manager@example.local', 'admin@example.local',
             'user@example.com', 'manager@example.com', 'admin@example.com'],
      },
    },
  });
  if (removed.count) console.log(`Removed legacy demo users: ${removed.count}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
