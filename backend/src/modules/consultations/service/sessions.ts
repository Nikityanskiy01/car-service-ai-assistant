import { createGuestToken, hashGuestToken, guestTokenMatches } from '../../../lib/guestToken.js';
import prisma from '../../../lib/prisma.js';
import { AppError } from '../../../lib/errors.js';
import { BOOTSTRAP_ASSISTANT_MESSAGE } from '../../../services/consultationFlowService.js';
import { assertActorCanReadSession, sessionDetailInclude } from './access.js';
import { decodeCursor, nextCursorFromPage } from '../../../lib/cursorPage.js';

export async function createSessionForClient(clientId, { serviceCategoryId }: any = {}) {
  if (serviceCategoryId) {
    const cat = await prisma.serviceCategory.findUnique({ where: { id: serviceCategoryId } });
    if (!cat) throw new AppError(400, 'Неизвестная категория услуги.', 'BAD_REQUEST');
  }
  const row = await prisma.consultationSession.create({
    data: {
      clientId,
      guestToken: null,
      serviceCategoryId: serviceCategoryId || null,
      extracted: { create: {} },
    },
    include: { extracted: true, serviceCategory: true },
  });
  await bootstrapOpeningTurn(row.id);
  return prisma.consultationSession.findUnique({
    where: { id: row.id },
    include: { extracted: true, serviceCategory: true },
  });
}

export async function createGuestSession({ serviceCategoryId }: any = {}) {
  if (serviceCategoryId) {
    const cat = await prisma.serviceCategory.findUnique({ where: { id: serviceCategoryId } });
    if (!cat) throw new AppError(400, 'Неизвестная категория услуги.', 'BAD_REQUEST');
  }
  const guestToken = createGuestToken();
  const row = await prisma.consultationSession.create({
    data: {
      clientId: null,
      guestToken: hashGuestToken(guestToken),
      serviceCategoryId: serviceCategoryId || null,
      extracted: { create: {} },
    },
    include: { extracted: true, serviceCategory: true },
  });
  await bootstrapOpeningTurn(row.id);
  const full = await prisma.consultationSession.findUnique({
    where: { id: row.id },
    include: { extracted: true, serviceCategory: true },
  });
  return { session: full, guestToken };
}

export async function bootstrapOpeningTurn(sessionId) {
  const preliminaryNote =
    'Ответ носит информационный характер и не заменяет осмотр автомобиля в сервисе.';
  await prisma.$transaction([
    prisma.message.create({
      data: { sessionId, sender: 'ASSISTANT', content: BOOTSTRAP_ASSISTANT_MESSAGE },
    }),
    prisma.consultationSession.update({
      where: { id: sessionId },
      data: {
        preliminaryNote,
        flowState: { asked_questions: [], stage: 'INITIAL', intent: null, service_type: null },
      },
    }),
  ]);
}

export async function claimSession(sessionId, clientId, guestToken) {
  const t = String(guestToken || '').trim();
  if (!t) throw new AppError(400, 'Требуется гостевой токен консультации.', 'BAD_REQUEST');
  const session = await prisma.consultationSession.findUnique({ where: { id: sessionId } });
  if (!session) throw new AppError(404, 'Сессия не найдена.', 'NOT_FOUND');
  if (session.clientId) throw new AppError(409, 'Сессия уже привязана к аккаунту.', 'CONFLICT');
  if (!guestTokenMatches(session.guestToken, t)) throw new AppError(403, 'Недействительный гостевой токен.', 'FORBIDDEN');
  await prisma.$transaction([
    prisma.consultationSession.update({
      where: { id: sessionId },
      data: { clientId, guestToken: null },
    }),
    // If a guest already created a service request for this session,
    // attach it to the new account so it appears in the client's dashboard.
    prisma.serviceRequest.updateMany({
      where: { consultationSessionId: sessionId, clientId: null },
      data: {
        clientId,
        guestName: null,
        guestPhone: null,
        guestEmail: null,
      },
    }),
  ]);
  return getSessionDetail(sessionId, { kind: 'owner', user: { id: clientId } });
}

export async function listSessions(clientId, { limit = 50, offset = 0 }: any = {}) {
  return prisma.consultationSession.findMany({
    where: { clientId },
    orderBy: { createdAt: 'desc' },
    take: Math.min(limit, 100),
    skip: offset,
    include: {
      extracted: true,
      serviceRequest: { select: { id: true, status: true } },
      serviceCategory: { select: { name: true } },
    },
  });
}

/** Список ИИ-сессий для менеджера / администратора (без гостевого токена). */
export async function listSessionsForStaff({ limit = 500, offset = 0, cursor }: any = {}) {
  const take = Math.min(Math.max(1, limit), 500);
  const skip = cursor ? 0 : Math.max(0, offset);
  const decoded = decodeCursor(cursor);
  const include = {
    client: { select: { id: true, fullName: true, phone: true, email: true, emailProfile: true } },
    extracted: true,
    serviceRequest: { select: { id: true, status: true } },
    serviceCategory: { select: { id: true, name: true } },
  };
  const where = decoded
    ? {
        OR: [
          { updatedAt: { lt: new Date(decoded.t) } },
          { updatedAt: new Date(decoded.t), id: { lt: decoded.id } },
        ],
      }
    : {};
  const [items, total] = await prisma.$transaction([
    prisma.consultationSession.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take,
      skip,
      include,
    }),
    prisma.consultationSession.count(),
  ]);
  return {
    items,
    total,
    nextCursor: nextCursorFromPage(items, {
      limit: take,
      getCursor: (row) => ({ id: row.id, t: row.updatedAt.toISOString() }),
    }),
  };
}

export async function getSessionDetail(sessionId, actor) {
  let session = await prisma.consultationSession.findUnique({
    where: { id: sessionId },
    include: sessionDetailInclude,
  });
  if (!session) throw new AppError(404, 'Сессия не найдена.', 'NOT_FOUND');
  assertActorCanReadSession(session, actor);
  if (!Array.isArray(session.messages) || session.messages.length === 0) {
    await bootstrapOpeningTurn(sessionId);
    session = await prisma.consultationSession.findUnique({
      where: { id: sessionId },
      include: sessionDetailInclude,
    });
  }
  return session;
}
