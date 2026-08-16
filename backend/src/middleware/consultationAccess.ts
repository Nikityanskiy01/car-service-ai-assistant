import prisma from '../lib/prisma.js';
import { apiMessages } from '../config/apiMessages.js';
import { guestTokenMatches } from '../lib/guestToken.js';

export async function consultationSessionAccess(req, res, next) {
  const { sessionId } = req.params;
  if (!sessionId) return next();

  const session = await prisma.consultationSession.findUnique({
    where: { id: sessionId },
    select: { id: true, clientId: true, guestToken: true },
  });
  if (!session) {
    return res.status(404).json({ error: apiMessages.common.sessionNotFound, code: 'NOT_FOUND' });
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
    return res.status(403).json({ error: apiMessages.common.forbidden, code: 'CONSULTATION_FORBIDDEN' });
  }

  const hdr = req.headers['x-consultation-guest-token'];
  if (guestTokenMatches(session.guestToken, hdr)) {
    req.consultationActor = { kind: 'guest' };
    return next();
  }

  return res.status(401).json({
    error: 'Требуется вход или гостевой токен консультации',
    code: 'GUEST_TOKEN_REQUIRED',
  });
}

export function blockStaffFromPosting(req, res, next) {
  if (req.consultationActor?.kind === 'staff') {
    return res.status(403).json({ error: 'Недоступно для роли менеджера' });
  }
  next();
}
