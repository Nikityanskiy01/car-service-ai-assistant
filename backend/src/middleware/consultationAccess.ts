import type { NextFunction, Request, Response } from 'express';
import prisma from '../lib/prisma.js';
import { apiMessages } from '../config/apiMessages.js';
import { guestTokenMatches } from '../lib/guestToken.js';
import { sendProblem } from '../lib/problem.js';

export async function consultationSessionAccess(req: Request, res: Response, next: NextFunction) {
  const { sessionId } = req.params;
  if (!sessionId) return next();

  const session = await prisma.consultationSession.findUnique({
    where: { id: sessionId },
    select: { id: true, clientId: true, guestToken: true },
  });
  if (!session) {
    return sendProblem(res, { status: 404, detail: apiMessages.common.sessionNotFound, code: 'NOT_FOUND' });
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
    return sendProblem(res, { status: 403, detail: apiMessages.common.forbidden, code: 'CONSULTATION_FORBIDDEN' });
  }

  const hdr = req.headers['x-consultation-guest-token'];
  if (guestTokenMatches(session.guestToken, hdr)) {
    req.consultationActor = { kind: 'guest' };
    return next();
  }

  return sendProblem(res, {
    status: 401,
    detail: 'Требуется вход или гостевой токен консультации',
    code: 'GUEST_TOKEN_REQUIRED',
  });
}

export function blockStaffFromPosting(req: Request, res: Response, next: NextFunction) {
  if (req.consultationActor?.kind === 'staff') {
    return sendProblem(res, { status: 403, detail: 'Недоступно для роли менеджера', code: 'FORBIDDEN' });
  }
  next();
}
