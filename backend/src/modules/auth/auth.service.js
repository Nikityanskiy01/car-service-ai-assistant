import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { getEnv } from '../../config/env.js';
import prisma from '../../lib/prisma.js';
import { AppError } from '../../lib/errors.js';

const SALT_ROUNDS = 10;

function toPublicUser(u) {
  return {
    id: u.id,
    email: u.email,
    fullName: u.fullName,
    phone: u.phone,
    role: u.role,
    emailProfile: u.emailProfile,
  };
}

export async function register({ email, password, fullName, phone }) {
  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) throw new AppError(409, 'Email already registered', 'CONFLICT');
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      passwordHash,
      fullName,
      phone,
      role: 'CLIENT',
    },
  });
  return issueTokens(user);
}

export async function login({ email, password }) {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) throw new AppError(401, 'Invalid credentials', 'UNAUTHORIZED');
  if (user.blocked) throw new AppError(403, 'Account blocked', 'BLOCKED');
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw new AppError(401, 'Invalid credentials', 'UNAUTHORIZED');
  return issueTokens(user);
}

function issueTokens(user) {
  const env = getEnv();
  const accessToken = jwt.sign({ sub: user.id, role: user.role }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  });
  return { accessToken, user: toPublicUser(user) };
}
