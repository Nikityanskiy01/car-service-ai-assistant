import { Router } from 'express';
import { z } from 'zod';
import { authJwt } from '../../middleware/authJwt.js';
import { requireRole } from '../../middleware/requireRole.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { createPublicWriteLimiter } from '../../middleware/publicWriteLimiter.js';
import { idempotency } from '../../middleware/idempotency.js';
import { validateBody } from '../../middleware/validate.js';
import { recordConsentEvent } from '../privacy/consent.service.js';
import { sendProblem } from '../../lib/problem.js';
import * as bookingsService from './bookings.service.js';
import { createStaffBooking } from './staffBooking.service.js';

const createSchema = z.object({
  preferredAt: z.string().min(4),
  serviceRequestId: z.string().uuid().optional().nullable(),
  vehicleId: z.string().uuid().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

const createGuestSchema = z.object({
  preferredAt: z.string().min(4),
  fullName: z.string().trim().min(1).max(120),
  phone: z.string().min(1).max(40),
  email: z.string().trim().max(120).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  serviceTitle: z.string().trim().max(200).optional().nullable(),
  categoryLabel: z.string().trim().max(200).optional().nullable(),
  consentPersonalData: z.literal(true, {
    errorMap: () => ({ message: 'Необходимо согласие на обработку персональных данных' }),
  }),
});

const patchSchema = z
  .object({
    status: z.enum(['PENDING', 'CONFIRMED', 'ARRIVED', 'NO_SHOW', 'CANCELLED']).optional(),
    preferredAt: z.string().min(4).optional(),
    notes: z.string().max(2000).optional().nullable(),
    guestName: z.string().trim().min(1).max(120).optional(),
    guestPhone: z.string().min(1).max(40).optional(),
    guestEmail: z.string().trim().max(120).optional().nullable(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: 'Укажите хотя бы одно поле' });

const clientPatchSchema = z
  .object({
    status: z.literal('CANCELLED').optional(),
    preferredAt: z.string().min(4).optional(),
  })
  .refine((o) => Boolean(o.status) !== Boolean(o.preferredAt), {
    message: 'Укажите новую дату или отмену',
  });

export const bookingsRouter = Router();

const guestWriteLimiter = createPublicWriteLimiter(20);

bookingsRouter.post(
  '/guest',
  guestWriteLimiter,
  validateBody(createGuestSchema),
  idempotency(),
  asyncHandler(async (req, res) => {
    const b = await bookingsService.createGuestBooking(req.validatedBody);
    await recordConsentEvent({
      subjectKey: `phone:${b.guestPhone || req.validatedBody.phone}`,
      purpose: 'guest_booking',
      ip: String(req.headers['x-forwarded-for'] || '')
        .split(',')[0]
        .trim() || req.ip || null,
      userAgent: req.get('user-agent') || null,
    });
    res.status(201).json(serialize(b));
  }),
);

bookingsRouter.use(authJwt);

bookingsRouter.post(
  '/',
  requireRole('CLIENT', 'MANAGER', 'ADMINISTRATOR'),
  validateBody(createSchema),
  idempotency(),
  asyncHandler(async (req, res) => {
    if (req.user.role === 'MANAGER' || req.user.role === 'ADMINISTRATOR') {
      const b = await createStaffBooking(req.user, req.validatedBody);
      return res.status(201).json(serialize(b));
    }
    const b = await bookingsService.createBooking(req.user, req.validatedBody);
    res.status(201).json(serialize(b));
  }),
);

bookingsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const staff = req.user.role === 'MANAGER' || req.user.role === 'ADMINISTRATOR';
    const limit = staff
      ? Math.min(200, Math.max(1, Number.parseInt(String(req.query.limit), 10) || 100))
      : Math.min(100, Math.max(1, Number.parseInt(String(req.query.limit), 10) || 50));
    const offset = staff
      ? Math.min(500, Math.max(0, Number.parseInt(String(req.query.offset), 10) || 0))
      : 0;
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
    const { items, nextCursor } = await bookingsService.listBookings(req.user, { limit, offset, cursor });
    const body = items.map(serialize);
    if (cursor || req.query.page === 'cursor') {
      res.setHeader('X-Next-Cursor', nextCursor || '');
      return res.json({ items: body, nextCursor, limit });
    }
    res.setHeader('X-Next-Cursor', nextCursor || '');
    res.json(body);
  }),
);

bookingsRouter.get(
  '/:bookingId',
  asyncHandler(async (req, res) => {
    const b = await bookingsService.getBooking(req.params.bookingId, req.user);
    res.json(serialize(b));
  }),
);

bookingsRouter.get(
  '/:bookingId/audit',
  requireRole('MANAGER', 'ADMINISTRATOR'),
  asyncHandler(async (req, res) => {
    const items = await bookingsService.listBookingAudit(req.params.bookingId, req.user);
    res.json(items);
  }),
);

bookingsRouter.patch(
  '/:bookingId',
  asyncHandler(async (req, res) => {
    if (req.user.role === 'CLIENT') {
      const parsed = clientPatchSchema.safeParse(req.body);
      if (!parsed.success) {
        const first = parsed.error.issues[0];
        return sendProblem(res, {
          status: 400,
          detail: first?.message || 'Проверьте введённые данные.',
          code: 'VALIDATION_ERROR',
        });
      }
      const b = await bookingsService.patchClientBooking(req.params.bookingId, req.user, parsed.data);
      return res.json(serialize(b));
    }
    if (req.user.role === 'MANAGER' || req.user.role === 'ADMINISTRATOR') {
      const parsed = patchSchema.safeParse(req.body);
      if (!parsed.success) {
        const first = parsed.error.issues[0];
        return sendProblem(res, {
          status: 400,
          detail: first?.message || 'Проверьте введённые данные.',
          code: 'VALIDATION_ERROR',
        });
      }
      const b = await bookingsService.patchBooking(req.params.bookingId, req.user, parsed.data);
      return res.json(serialize(b));
    }
    return sendProblem(res, { status: 403, detail: 'Недостаточно прав для выполнения действия.', code: 'FORBIDDEN' });
  }),
);

function serialize(b) {
  return {
    id: b.id,
    clientId: b.clientId,
    vehicleId: b.vehicleId ?? null,
    guestName: b.guestName,
    guestPhone: b.guestPhone,
    guestEmail: b.guestEmail,
    serviceRequestId: b.serviceRequestId,
    preferredAt: b.preferredAt.toISOString(),
    createdAt: b.createdAt.toISOString(),
    status: b.status,
    notes: b.notes,
    client: b.client,
    vehicle: b.vehicle
      ? {
          id: b.vehicle.id,
          make: b.vehicle.make,
          model: b.vehicle.model,
          year: b.vehicle.year ?? null,
          licensePlate: b.vehicle.licensePlate ?? null,
        }
      : null,
    serviceRequest: b.serviceRequest
      ? {
          id: b.serviceRequest.id,
          status: b.serviceRequest.status,
          assignedManagerId: b.serviceRequest.assignedManagerId,
          snapshotMake: b.serviceRequest.snapshotMake,
          snapshotModel: b.serviceRequest.snapshotModel,
          snapshotSymptoms: b.serviceRequest.snapshotSymptoms,
        }
      : b.serviceRequest,
  };
}
