import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const email = 'manager@example.local';
const password = '1q2w3e4r5t';
const user = await prisma.user.findUnique({ where: { email } });
if (!user) {
  console.log('USER NOT FOUND');
} else {
  const ok = await bcrypt.compare(password, user.passwordHash);
  console.log({ email, role: user.role, blocked: user.blocked, passwordOk: ok });
}
await prisma.$disconnect();
