import crypto from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { getEnv } from '../../config/env.js';
import prisma from '../../lib/prisma.js';
import { AppError } from '../../lib/errors.js';
import { isValidPhoneDigits, normalizePhone } from '../contact/contact.service.js';

const SALT_ROUNDS = 10;

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

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
  if (existing) throw new AppError(409, 'Registration failed', 'CONFLICT');
  const digits = normalizePhone(phone);
  if (!isValidPhoneDigits(digits)) {
    throw new AppError(400, 'Укажите корректный номер телефона', 'BAD_REQUEST');
  }
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      passwordHash,
      fullName,
      phone: digits,
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

export async function refreshAccessToken(refreshTokenValue) {
  if (!refreshTokenValue) throw new AppError(401, 'Refresh token required', 'UNAUTHORIZED');

  const hashed = hashToken(refreshTokenValue);
  const record = await prisma.refreshToken.findUnique({ where: { token: hashed } });
  if (!record || record.expiresAt < new Date()) {
    if (record) await prisma.refreshToken.delete({ where: { id: record.id } }).catch(() => {});
    throw new AppError(401, 'Refresh token expired or invalid', 'UNAUTHORIZED');
  }

  const user = await prisma.user.findUnique({ where: { id: record.userId } });
  if (!user || user.blocked) {
    await prisma.refreshToken.delete({ where: { id: record.id } }).catch(() => {});
    throw new AppError(401, 'User not found or blocked', 'UNAUTHORIZED');
  }

  await prisma.refreshToken.delete({ where: { id: record.id } });
  return issueTokens(user);
}

export async function logout(refreshTokenValue) {
  if (!refreshTokenValue) return;
  const hashed = hashToken(refreshTokenValue);
  await prisma.refreshToken.deleteMany({ where: { token: hashed } });
}

async function issueTokens(user) {
  const env = getEnv();
  const accessToken = jwt.sign({ sub: user.id, role: user.role }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  });

  const refreshTokenValue = crypto.randomBytes(48).toString('base64url');
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000);
  await prisma.refreshToken.create({
    data: { userId: user.id, token: hashToken(refreshTokenValue), expiresAt },
  });

  return { accessToken, refreshToken: refreshTokenValue, user: toPublicUser(user) };
}
