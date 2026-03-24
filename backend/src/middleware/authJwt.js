import jwt from 'jsonwebtoken';
import { getEnv } from '../config/env.js';
import prisma from '../lib/prisma.js';

export async function authJwt(req, res, next) {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const token = h.slice(7);
    const payload = jwt.verify(token, getEnv().JWT_SECRET);
    const sub = payload.sub;
    if (typeof sub !== 'string') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const user = await prisma.user.findUnique({ where: { id: sub } });
    if (!user || user.blocked) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    req.user = { id: user.id, role: user.role, email: user.email };
    next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}
