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

const patchSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'CANCELLED']),
});

export const bookingsRouter = Router();
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
    const list = await bookingsService.listBookings(req.user);
    res.json(list.map(serialize));
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
    serviceRequestId: b.serviceRequestId,
    preferredAt: b.preferredAt.toISOString(),
    status: b.status,
    notes: b.notes,
    client: b.client,
    serviceRequest: b.serviceRequest,
  };
}
