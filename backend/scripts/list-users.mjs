import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const users = await prisma.user.findMany({
  select: { email: true, role: true, blocked: true },
  orderBy: { email: 'asc' },
});
console.log(users);
await prisma.$disconnect();
