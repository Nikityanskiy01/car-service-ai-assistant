import { AppError } from '../../../lib/errors.js';

export const sessionDetailInclude: any = {
  client: { select: { id: true, fullName: true, phone: true, email: true, emailProfile: true } },
  extracted: true,
  messages: { orderBy: { createdAt: 'asc' } },
  recommendations: true,
  serviceCategory: true,
  serviceRequest: true,
  diagnosisJob: true,
};

/**
 * @typedef {{ kind: 'staff', user: { id: string, role: string } } | { kind: 'owner', user: { id: string } } | { kind: 'guest' }} ConsultationActor
 */

/** @param session @param actor */
export function assertActorCanReadSession(session, actor) {
  if (actor.kind === 'staff') return;
  if (actor.kind === 'owner') {
    if (session.clientId !== actor.user.id) throw new AppError(403, 'Недостаточно прав для выполнения действия.', 'FORBIDDEN');
    return;
  }
  if (actor.kind === 'guest') {
    if (session.clientId != null) throw new AppError(403, 'Недостаточно прав для выполнения действия.', 'FORBIDDEN');
    return;
  }
  throw new AppError(403, 'Недостаточно прав для выполнения действия.', 'FORBIDDEN');
}

/** @param session @param actor */
export function assertActorCanPost(session, actor) {
  if (actor.kind === 'staff') throw new AppError(403, 'Недостаточно прав для выполнения действия.', 'FORBIDDEN');
  if (actor.kind === 'owner') {
    if (session.clientId !== actor.user.id) throw new AppError(403, 'Недостаточно прав для выполнения действия.', 'FORBIDDEN');
    return;
  }
  if (actor.kind === 'guest') {
    if (session.clientId != null) throw new AppError(403, 'Недостаточно прав для выполнения действия.', 'FORBIDDEN');
    return;
  }
  throw new AppError(403, 'Недостаточно прав для выполнения действия.', 'FORBIDDEN');
}
