import prisma from '../../lib/prisma.js';
import { AppError } from '../../lib/errors.js';
import { assertPreferredAtInBookingWindow } from '../../lib/bookingHours.js';
import { isValidPhoneDigits, normalizePhone } from '../contact/contact.service.js';

function buildGuestBookingNotes({ serviceTitle, categoryLabel, userNotes }) {
  const parts = [];
  if (serviceTitle) parts.push(`Услуга: ${String(serviceTitle).trim()}`);
  if (categoryLabel) parts.push(`Раздел: ${String(categoryLabel).trim()}`);
  const u = userNotes != null ? String(userNotes).trim() : '';
  if (u) parts.push(u);
  const text = parts.join('\n\n');
  return text.length ? text.slice(0, 2000) : null;
}

export async function createGuestBooking({
  preferredAt,
  fullName,
  phone,
  email,
  notes,
  serviceTitle,
  categoryLabel,
}) {
  const at = new Date(preferredAt);
  if (Number.isNaN(at.getTime())) throw new AppError(400, 'Invalid preferredAt', 'BAD_REQUEST');
  const slot = assertPreferredAtInBookingWindow(at);
  if (!slot.ok) throw new AppError(400, slot.message, 'BAD_REQUEST');

  const name = String(fullName || '').trim();
  if (!name) throw new AppError(400, 'Имя обязательно', 'BAD_REQUEST');

  const digits = normalizePhone(phone);
  if (!isValidPhoneDigits(digits)) {
    throw new AppError(400, 'Укажите корректный номер телефона', 'BAD_REQUEST');
  }

  let guestEmail = email != null ? String(email).trim() : '';
  guestEmail = guestEmail.length ? guestEmail.slice(0, 120) : null;
  if (guestEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail)) {
    throw new AppError(400, 'Некорректный email', 'BAD_REQUEST');
  }

  const composedNotes = buildGuestBookingNotes({ serviceTitle, categoryLabel, userNotes: notes });

  return prisma.serviceBooking.create({
    data: {
      clientId: null,
      guestName: name.slice(0, 120),
      guestPhone: digits,
      guestEmail,
      preferredAt: at,
      notes: composedNotes,
    },
  });
}

export async function createBooking(user, { preferredAt, serviceRequestId, notes }) {
  const at = new Date(preferredAt);
  if (Number.isNaN(at.getTime())) throw new AppError(400, 'Invalid preferredAt', 'BAD_REQUEST');
  const slot = assertPreferredAtInBookingWindow(at);
  if (!slot.ok) throw new AppError(400, slot.message, 'BAD_REQUEST');
  if (serviceRequestId) {
    const sr = await prisma.serviceRequest.findUnique({ where: { id: serviceRequestId } });
    if (!sr || sr.clientId !== user.id) throw new AppError(400, 'Invalid serviceRequestId', 'BAD_REQUEST');
  }
  return prisma.serviceBooking.create({
    data: {
      clientId: user.id,
      preferredAt: at,
      serviceRequestId: serviceRequestId || null,
      notes: notes ? String(notes).slice(0, 2000) : null,
    },
  });
}

export async function listBookings(user, { limit = 50, offset = 0 } = {}) {
  const take = Math.min(limit, 100);
  if (user.role === 'MANAGER' || user.role === 'ADMINISTRATOR') {
    return prisma.serviceBooking.findMany({
      orderBy: { preferredAt: 'asc' },
      take,
      skip: offset,
      include: {
        client: { select: { id: true, fullName: true, phone: true, email: true } },
        serviceRequest: { select: { id: true, status: true } },
      },
    });
  }
  if (user.role === 'CLIENT') {
    return prisma.serviceBooking.findMany({
      where: { clientId: user.id },
      orderBy: { preferredAt: 'desc' },
      take,
      skip: offset,
      include: { serviceRequest: { select: { id: true, status: true } } },
    });
  }
  throw new AppError(403, 'Forbidden', 'FORBIDDEN');
}

export async function listBookingAudit(bookingId, user) {
  if (user.role !== 'ADMINISTRATOR') {
    throw new AppError(403, 'Forbidden', 'FORBIDDEN');
  }
  const exists = await prisma.serviceBooking.findUnique({ where: { id: bookingId }, select: { id: true } });
  if (!exists) throw new AppError(404, 'Not found', 'NOT_FOUND');
  const rows = await prisma.serviceBookingAuditLog.findMany({
    where: { bookingId },
    orderBy: { createdAt: 'desc' },
    include: { actor: { select: { id: true, fullName: true, email: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    createdAt: r.createdAt.toISOString(),
    actor: r.actor,
    changes: r.changes,
  }));
}

/**
 * @param {import('@prisma/client').User} user
 * @param {{
 *   status?: import('@prisma/client').BookingStatus;
 *   preferredAt?: string;
 *   notes?: string | null;
 *   guestName?: string;
 *   guestPhone?: string;
 *   guestEmail?: string | null;
 * }} body
 */
export async function patchBooking(bookingId, user, body) {
  if (user.role !== 'MANAGER' && user.role !== 'ADMINISTRATOR') {
    throw new AppError(403, 'Forbidden', 'FORBIDDEN');
  }

  const prev = await prisma.serviceBooking.findUnique({ where: { id: bookingId } });
  if (!prev) throw new AppError(404, 'Not found', 'NOT_FOUND');

  /** @type {Record<string, { from: unknown; to: unknown }>} */
  const changes = {};
  const data = {};

  if (body.status !== undefined && body.status !== prev.status) {
    data.status = body.status;
    changes.status = { from: prev.status, to: body.status };
  }

  if (body.preferredAt !== undefined) {
    const at = new Date(body.preferredAt);
    if (Number.isNaN(at.getTime())) throw new AppError(400, 'Invalid preferredAt', 'BAD_REQUEST');
    const slot = assertPreferredAtInBookingWindow(at);
    if (!slot.ok) throw new AppError(400, slot.message, 'BAD_REQUEST');
    if (at.getTime() !== prev.preferredAt.getTime()) {
      data.preferredAt = at;
      changes.preferredAt = { from: prev.preferredAt.toISOString(), to: at.toISOString() };
    }
  }

  if (body.notes !== undefined) {
    const next =
      body.notes == null || String(body.notes).trim() === '' ? null : String(body.notes).slice(0, 2000);
    const prevNotes = prev.notes ?? null;
    if (next !== prevNotes) {
      data.notes = next;
      changes.notes = { from: prevNotes, to: next };
    }
  }

  if (!prev.clientId) {
    if (body.guestName !== undefined) {
      const n = String(body.guestName || '').trim().slice(0, 120);
      if (!n) throw new AppError(400, 'Имя не может быть пустым', 'BAD_REQUEST');
      if (n !== prev.guestName) {
        data.guestName = n;
        changes.guestName = { from: prev.guestName, to: n };
      }
    }
    if (body.guestPhone !== undefined) {
      const digits = normalizePhone(body.guestPhone);
      if (!isValidPhoneDigits(digits)) {
        throw new AppError(400, 'Некорректный телефон', 'BAD_REQUEST');
      }
      if (digits !== prev.guestPhone) {
        data.guestPhone = digits;
        changes.guestPhone = { from: prev.guestPhone, to: digits };
      }
    }
    if (body.guestEmail !== undefined) {
      let em = body.guestEmail == null ? '' : String(body.guestEmail).trim();
      em = em.length ? em.slice(0, 120) : null;
      if (em && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
        throw new AppError(400, 'Некорректный email', 'BAD_REQUEST');
      }
      const prevEm = prev.guestEmail ?? null;
      if (em !== prevEm) {
        data.guestEmail = em;
        changes.guestEmail = { from: prevEm, to: em };
      }
    }
  }

  if (Object.keys(data).length === 0) {
    return prisma.serviceBooking.findUnique({
      where: { id: bookingId },
      include: {
        client: { select: { id: true, fullName: true, phone: true, email: true } },
        serviceRequest: { select: { id: true, status: true } },
      },
    });
  }

  return prisma.$transaction(async (tx) => {
    const row = await tx.serviceBooking.update({
      where: { id: bookingId },
      data,
      include: {
        client: { select: { id: true, fullName: true, phone: true, email: true } },
        serviceRequest: { select: { id: true, status: true } },
      },
    });
    await tx.serviceBookingAuditLog.create({
      data: {
        bookingId,
        actorId: user.id,
        changes,
      },
    });
    return row;
  });
}
