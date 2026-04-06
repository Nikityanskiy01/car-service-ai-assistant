import { Router } from 'express';
import { z } from 'zod';
import { authJwt } from '../../middleware/authJwt.js';
import { requireRole } from '../../middleware/requireRole.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { validateBody } from '../../middleware/validate.js';
import * as bookingsService from './bookings.service.js';

const createSchema = z.object({
  preferredAt: z.string().min(4),
  serviceRequestId: z.string().uuid().optional().nullable(),
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
});

const patchSchema = z
  .object({
    status: z.enum(['PENDING', 'CONFIRMED', 'CANCELLED']).optional(),
    preferredAt: z.string().min(4).optional(),
    notes: z.string().max(2000).optional().nullable(),
    guestName: z.string().trim().min(1).max(120).optional(),
    guestPhone: z.string().min(1).max(40).optional(),
    guestEmail: z.string().trim().max(120).optional().nullable(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: 'Укажите хотя бы одно поле' });

export const bookingsRouter = Router();

bookingsRouter.post(
  '/guest',
  validateBody(createGuestSchema),
  asyncHandler(async (req, res) => {
    const b = await bookingsService.createGuestBooking(req.validatedBody);
    res.status(201).json(serialize(b));
  }),
);

bookingsRouter.use(authJwt);

bookingsRouter.post(
  '/',
  requireRole('CLIENT'),
  validateBody(createSchema),
  asyncHandler(async (req, res) => {
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
    const list = await bookingsService.listBookings(req.user, { limit, offset });
    res.json(list.map(serialize));
  }),
);

bookingsRouter.get(
  '/:bookingId/audit',
  requireRole('ADMINISTRATOR'),
  asyncHandler(async (req, res) => {
    const items = await bookingsService.listBookingAudit(req.params.bookingId, req.user);
    res.json(items);
  }),
);

bookingsRouter.patch(
  '/:bookingId',
  requireRole('MANAGER', 'ADMINISTRATOR'),
  validateBody(patchSchema),
  asyncHandler(async (req, res) => {
    const b = await bookingsService.patchBooking(req.params.bookingId, req.user, req.validatedBody);
    res.json(serialize(b));
  }),
);

function serialize(b) {
  return {
    id: b.id,
    clientId: b.clientId,
    guestName: b.guestName,
    guestPhone: b.guestPhone,
    guestEmail: b.guestEmail,
    serviceRequestId: b.serviceRequestId,
    preferredAt: b.preferredAt.toISOString(),
    createdAt: b.createdAt.toISOString(),
    status: b.status,
    notes: b.notes,
    client: b.client,
    serviceRequest: b.serviceRequest,
  };
}
