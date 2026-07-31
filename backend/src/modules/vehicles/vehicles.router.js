import { Router } from 'express';
import { z } from 'zod';
import { authJwt } from '../../middleware/authJwt.js';
import { requireRole } from '../../middleware/requireRole.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { validateBody } from '../../middleware/validate.js';
import * as vehiclesService from './vehicles.service.js';

const createSchema = z.object({
  make: z.string().trim().min(1).max(80),
  model: z.string().trim().min(1).max(80),
  year: z.coerce.number().int().min(1950).max(new Date().getFullYear() + 1).optional().nullable(),
  vin: z.string().trim().max(32).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
});

export const vehiclesRouter = Router();

vehiclesRouter.use(authJwt, requireRole('CLIENT'));

vehiclesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const vehicles = await vehiclesService.listVehicles(req.user.id);
    res.json(vehicles);
  }),
);

vehiclesRouter.get(
  '/:vehicleId',
  asyncHandler(async (req, res) => {
    const vehicle = await vehiclesService.getVehicle(req.user.id, req.params.vehicleId);
    res.json(vehicle);
  }),
);

vehiclesRouter.post(
  '/',
  validateBody(createSchema),
  asyncHandler(async (req, res) => {
    const vehicle = await vehiclesService.createVehicle(req.user.id, req.validatedBody);
    res.status(201).json(vehicle);
  }),
);

vehiclesRouter.delete(
  '/:vehicleId',
  asyncHandler(async (req, res) => {
    await vehiclesService.deleteVehicle(req.user.id, req.params.vehicleId);
    res.status(204).end();
  }),
);
