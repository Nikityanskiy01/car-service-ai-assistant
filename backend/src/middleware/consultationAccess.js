import crypto from 'crypto';
import prisma from '../lib/prisma.js';

/**
 * После optionalAuthJwt. Проверяет доступ к сессии :sessionId (JWT-владелец, гость по X-Consultation-Guest-Token, менеджер).
 * Выставляет req.consultationActor: { kind: 'staff'|'owner'|'guest', user? }.
 */
export async function consultationSessionAccess(req, res, next) {
  const { sessionId } = req.params;
  if (!sessionId) return next();

  const session = await prisma.consultationSession.findUnique({
    where: { id: sessionId },
    select: { id: true, clientId: true, guestToken: true },
  });
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const u = req.user;
  if (u?.role === 'MANAGER' || u?.role === 'ADMINISTRATOR') {
    req.consultationActor = { kind: 'staff', user: u };
    return next();
  }

  if (session.clientId) {
    if (u && session.clientId === u.id) {
      req.consultationActor = { kind: 'owner', user: u };
      return next();
    }
    return res.status(403).json({ error: 'Forbidden' });
  }

  const hdr = req.headers['x-consultation-guest-token'];
  if (
    typeof hdr === 'string' &&
    hdr.length > 0 &&
    session.guestToken &&
    crypto.timingSafeEqual(Buffer.from(session.guestToken), Buffer.from(hdr))
  ) {
    req.consultationActor = { kind: 'guest' };
    return next();
  }

  return res.status(401).json({
    error: 'Требуется вход или гостевой токен консультации',
    code: 'GUEST_TOKEN_REQUIRED',
  });
}

/** Менеджер не пишет в чужой чат от имени клиента. */
export function blockStaffFromPosting(req, res, next) {
  if (req.consultationActor?.kind === 'staff') {
    return res.status(403).json({ error: 'Недоступно для роли менеджера' });
  }
  next();
}
