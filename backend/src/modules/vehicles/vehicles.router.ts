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
  licensePlate: z.string().trim().max(16).optional().nullable(),
  color: z.string().trim().max(40).optional().nullable(),
});

const updateSchema = z.object({
  currentMileageKm: z.coerce.number().int().min(0).max(2_000_000).optional().nullable(),
  vin: z.string().trim().max(32).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
  licensePlate: z.string().trim().max(16).optional().nullable(),
  color: z.string().trim().max(40).optional().nullable(),
});

const photoSchema = z.object({
  mimeType: z.string().trim().min(1).max(64),
  contentBase64: z.string().min(1),
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
  '/:vehicleId/photo',
  asyncHandler(async (req, res) => {
    const file = await vehiclesService.getVehiclePhoto(req.user.id, req.params.vehicleId);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.send(file.buffer);
  }),
);

vehiclesRouter.post(
  '/:vehicleId/photo',
  validateBody(photoSchema),
  asyncHandler(async (req, res) => {
    const vehicle = await vehiclesService.uploadVehiclePhoto(
      req.user.id,
      req.params.vehicleId,
      req.validatedBody,
    );
    res.json(vehicle);
  }),
);

vehiclesRouter.delete(
  '/:vehicleId/photo',
  asyncHandler(async (req, res) => {
    const vehicle = await vehiclesService.removeVehiclePhoto(req.user.id, req.params.vehicleId);
    res.json(vehicle);
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

vehiclesRouter.patch(
  '/:vehicleId',
  validateBody(updateSchema),
  asyncHandler(async (req, res) => {
    const vehicle = await vehiclesService.updateVehicle(
      req.user.id,
      req.params.vehicleId,
      req.validatedBody,
    );
    res.json(vehicle);
  }),
);

vehiclesRouter.delete(
  '/:vehicleId',
  asyncHandler(async (req, res) => {
    await vehiclesService.deleteVehicle(req.user.id, req.params.vehicleId);
    res.status(204).end();
  }),
);
