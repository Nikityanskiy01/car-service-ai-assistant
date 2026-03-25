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

const categoryPatchSchema = z
  .object({
    name: z.string().min(1).optional(),
    description: z.string().optional().nullable(),
  })
  .refine((o) => o.name != null || o.description !== undefined, { message: 'At least one field required' });

const scenarioPatchSchema = z
  .object({
    title: z.string().min(1).optional(),
    description: z.string().optional().nullable(),
    active: z.boolean().optional(),
  })
  .refine((o) => o.title != null || o.description !== undefined || o.active != null, {
    message: 'At least one field required',
  });

const questionBodySchema = z.object({
  text: z.string().min(1),
  order: z.number().int().optional(),
});

const questionPatchSchema = z
  .object({
    text: z.string().min(1).optional(),
    order: z.number().int().optional(),
  })
  .refine((o) => o.text != null || o.order != null, { message: 'At least one field required' });

const hintBodySchema = z.object({
  text: z.string().min(1),
  order: z.number().int().optional(),
});

const hintPatchSchema = z
  .object({
    text: z.string().min(1).optional(),
    order: z.number().int().optional(),
    scenarioId: z.string().uuid().nullable().optional(),
  })
  .refine((o) => o.text != null || o.order != null || o.scenarioId !== undefined, {
    message: 'At least one field required',
  });

const materialBodySchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  categoryId: z.string().uuid().nullable().optional(),
});

const materialPatchSchema = z
  .object({
    title: z.string().min(1).optional(),
    body: z.string().min(1).optional(),
    categoryId: z.string().uuid().nullable().optional(),
  })
  .refine((o) => o.title != null || o.body != null || o.categoryId !== undefined, {
    message: 'At least one field required',
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

adminRouter.patch(
  '/reference/service-categories/:categoryId',
  validateBody(categoryPatchSchema),
  asyncHandler(async (req, res) => {
    const row = await referenceService.updateCategory(req.params.categoryId, req.validatedBody);
    res.json(row);
  }),
);

adminRouter.delete(
  '/reference/service-categories/:categoryId',
  asyncHandler(async (req, res) => {
    await referenceService.deleteCategory(req.params.categoryId);
    res.status(204).send();
  }),
);

adminRouter.patch(
  '/reference/scenarios/:scenarioId',
  validateBody(scenarioPatchSchema),
  asyncHandler(async (req, res) => {
    const row = await referenceService.updateScenario(req.params.scenarioId, req.validatedBody);
    res.json(row);
  }),
);

adminRouter.delete(
  '/reference/scenarios/:scenarioId',
  asyncHandler(async (req, res) => {
    await referenceService.deleteScenario(req.params.scenarioId);
    res.status(204).send();
  }),
);

adminRouter.get(
  '/reference/scenarios/:scenarioId/questions',
  asyncHandler(async (req, res) => {
    res.json(await referenceService.listQuestions(req.params.scenarioId));
  }),
);

adminRouter.post(
  '/reference/scenarios/:scenarioId/questions',
  validateBody(questionBodySchema),
  asyncHandler(async (req, res) => {
    const row = await referenceService.createQuestion(req.params.scenarioId, req.validatedBody);
    res.status(201).json(row);
  }),
);

adminRouter.patch(
  '/reference/questions/:questionId',
  validateBody(questionPatchSchema),
  asyncHandler(async (req, res) => {
    const row = await referenceService.updateQuestion(req.params.questionId, req.validatedBody);
    res.json(row);
  }),
);

adminRouter.delete(
  '/reference/questions/:questionId',
  asyncHandler(async (req, res) => {
    await referenceService.deleteQuestion(req.params.questionId);
    res.status(204).send();
  }),
);

adminRouter.get(
  '/reference/scenarios/:scenarioId/hints',
  asyncHandler(async (req, res) => {
    res.json(await referenceService.listHints(req.params.scenarioId));
  }),
);

adminRouter.post(
  '/reference/scenarios/:scenarioId/hints',
  validateBody(hintBodySchema),
  asyncHandler(async (req, res) => {
    const row = await referenceService.createHint(req.params.scenarioId, req.validatedBody);
    res.status(201).json(row);
  }),
);

adminRouter.patch(
  '/reference/hints/:hintId',
  validateBody(hintPatchSchema),
  asyncHandler(async (req, res) => {
    const row = await referenceService.updateHint(req.params.hintId, req.validatedBody);
    res.json(row);
  }),
);

adminRouter.delete(
  '/reference/hints/:hintId',
  asyncHandler(async (req, res) => {
    await referenceService.deleteHint(req.params.hintId);
    res.status(204).send();
  }),
);

adminRouter.get(
  '/reference/reference-materials',
  asyncHandler(async (_req, res) => {
    res.json(await referenceService.listReferenceMaterials());
  }),
);

adminRouter.post(
  '/reference/reference-materials',
  validateBody(materialBodySchema),
  asyncHandler(async (req, res) => {
    const row = await referenceService.createReferenceMaterial(req.validatedBody);
    res.status(201).json(row);
  }),
);

adminRouter.patch(
  '/reference/reference-materials/:materialId',
  validateBody(materialPatchSchema),
  asyncHandler(async (req, res) => {
    const row = await referenceService.updateReferenceMaterial(req.params.materialId, req.validatedBody);
    res.json(row);
  }),
);

adminRouter.delete(
  '/reference/reference-materials/:materialId',
  asyncHandler(async (req, res) => {
    await referenceService.deleteReferenceMaterial(req.params.materialId);
    res.status(204).send();
  }),
);
