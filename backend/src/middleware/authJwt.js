import jwt from 'jsonwebtoken';
import { getEnv } from '../config/env.js';
import prisma from '../lib/prisma.js';

async function userFromBearer(req) {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return null;
  const token = h.slice(7);
  const payload = jwt.verify(token, getEnv().JWT_SECRET);
  const sub = payload.sub;
  if (typeof sub !== 'string') return null;
  const user = await prisma.user.findUnique({ where: { id: sub } });
  if (!user || user.blocked) return null;
  return { id: user.id, role: user.role, email: user.email };
}

export async function authJwt(req, res, next) {
  try {
    const user = await userFromBearer(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

/** Bearer опционален: при отсутствии или невалидном токене req.user = null (без 401). */
export async function optionalAuthJwt(req, res, next) {
  try {
    req.user = await userFromBearer(req);
  } catch {
    req.user = null;
  }
  next();
}
