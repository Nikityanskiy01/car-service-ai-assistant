import jwt from 'jsonwebtoken';
import { getEnv } from '../config/env.js';
import { COOKIE_ACCESS } from '../lib/authCookies.js';
import prisma from '../lib/prisma.js';

function getAccessTokenString(req) {
  const c = req.cookies?.[COOKIE_ACCESS];
  if (c && typeof c === 'string') return c;
  if (getEnv().NODE_ENV === 'test') {
    const h = req.headers.authorization;
    if (h?.startsWith('Bearer ')) return h.slice(7);
  }
  return null;
}

async function userFromToken(req) {
  const token = getAccessTokenString(req);
  if (!token) return null;
  const payload = jwt.verify(token, getEnv().JWT_SECRET, { algorithms: ['HS256'] });
  const sub = payload.sub;
  if (typeof sub !== 'string') return null;
  const user = await prisma.user.findUnique({ where: { id: sub } });
  if (!user || user.blocked) return null;
  return { id: user.id, role: user.role, email: user.email };
}

export async function authJwt(req, res, next) {
  try {
    const user = await userFromToken(req);
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
    req.user = await userFromToken(req);
  } catch {
    req.user = null;
  }
  next();
}
