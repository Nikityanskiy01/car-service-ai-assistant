import { Router } from 'express';
import { authJwt } from '../../middleware/authJwt.js';
import { requireRole } from '../../middleware/requireRole.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import * as analyticsService from './analytics.service.js';

export const analyticsRouter = Router();
analyticsRouter.use(authJwt);
analyticsRouter.use(requireRole('ADMINISTRATOR'));

analyticsRouter.get(
  '/summary',
  asyncHandler(async (_req, res) => {
    res.json(await analyticsService.summary());
  }),
);
