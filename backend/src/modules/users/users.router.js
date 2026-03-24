import { Router } from 'express';
import { z } from 'zod';
import { authJwt } from '../../middleware/authJwt.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { validateBody } from '../../middleware/validate.js';
import * as consultationsService from '../consultations/consultations.service.js';
import * as usersService from './users.service.js';

const patchSchema = z.object({
  fullName: z.string().min(1).optional(),
  phone: z.string().min(5).optional(),
  emailProfile: z.string().email().optional().nullable(),
});

export const usersRouter = Router();

usersRouter.use(authJwt);

usersRouter.get(
  '/me',
  asyncHandler(async (req, res) => {
    const u = await usersService.getMe(req.user.id);
    res.json(u);
  }),
);

usersRouter.patch(
  '/me',
  validateBody(patchSchema),
  asyncHandler(async (req, res) => {
    const u = await usersService.patchMe(req.user.id, req.validatedBody);
    res.json(u);
  }),
);

usersRouter.get(
  '/me/consultation-reports',
  asyncHandler(async (req, res) => {
    const rows = await consultationsService.listMyReports(req.user.id);
    res.json(
      rows.map((r) => ({
        id: r.id,
        consultationSessionId: r.consultationSessionId,
        createdAt: r.createdAt.toISOString(),
        label: r.label,
        snapshotJson: r.snapshotJson,
      })),
    );
  }),
);
