import { Router } from 'express';
import { z } from 'zod';
import { authJwt } from '../../middleware/authJwt.js';
import { requireRole } from '../../middleware/requireRole.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { validateBody } from '../../middleware/validate.js';
import * as adminService from './admin.service.js';
import * as referenceService from '../reference/reference.service.js';

const roleSchema = z.object({
  role: z.enum(['CLIENT', 'MANAGER', 'ADMINISTRATOR']),
});

const categorySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

const scenarioSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
});

export const adminRouter = Router();
adminRouter.use(authJwt);
adminRouter.use(requireRole('ADMINISTRATOR'));

adminRouter.get(
  '/users',
  asyncHandler(async (_req, res) => {
    const users = await adminService.listUsers();
    res.json(users);
  }),
);

adminRouter.patch(
  '/users/:userId/role',
  validateBody(roleSchema),
  asyncHandler(async (req, res) => {
    const u = await adminService.patchUserRole(req.params.userId, req.validatedBody.role);
    res.json(u);
  }),
);

adminRouter.post(
  '/users/:userId/block',
  asyncHandler(async (req, res) => {
    await adminService.blockUser(req.params.userId);
    res.status(204).send();
  }),
);

adminRouter.post(
  '/users/:userId/unblock',
  asyncHandler(async (req, res) => {
    await adminService.unblockUser(req.params.userId);
    res.status(204).send();
  }),
);

adminRouter.get(
  '/reference/service-categories',
  asyncHandler(async (_req, res) => {
    res.json(await referenceService.listCategories());
  }),
);

adminRouter.post(
  '/reference/service-categories',
  validateBody(categorySchema),
  asyncHandler(async (req, res) => {
    const row = await referenceService.createCategory(req.validatedBody);
    res.status(201).json(row);
  }),
);

adminRouter.get(
  '/reference/scenarios',
  asyncHandler(async (_req, res) => {
    res.json(await referenceService.listScenarios());
  }),
);

adminRouter.post(
  '/reference/scenarios',
  validateBody(scenarioSchema),
  asyncHandler(async (req, res) => {
    const row = await referenceService.createScenario(req.validatedBody);
    res.status(201).json(row);
  }),
);
