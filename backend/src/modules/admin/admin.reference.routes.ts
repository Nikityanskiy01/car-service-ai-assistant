import { Router } from 'express';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { validateBody } from '../../middleware/validate.js';
import * as adminService from './admin.service.js';
import * as referenceService from '../reference/reference.service.js';
import { invalidatePublicSiteItemsCache } from '../content/content.router.js';
import {
  categorySchema,
  categoryPatchSchema,
  scenarioSchema,
  scenarioPatchSchema,
  questionBodySchema,
  questionPatchSchema,
  hintBodySchema,
  hintPatchSchema,
  materialBodySchema,
  materialPatchSchema,
  contentBlockCreateSchema,
  contentBlockPatchSchema,
  rollbackSchema,
  cmsItemSchema,
  cmsReorderSchema,
} from './admin.schemas.js';

export function registerAdminReferenceRoutes(adminRouter: Router) {
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

adminRouter.get(
  '/site-content',
  asyncHandler(async (req, res) => {
    const section = req.query.section ? String(req.query.section) : undefined;
    res.json(await adminService.listContentBlocks({ section }));
  }),
);

adminRouter.post(
  '/site-content',
  validateBody(contentBlockCreateSchema),
  asyncHandler(async (req, res) => {
    const row = await adminService.createContentBlock(req.user.id, req.validatedBody);
    res.status(201).json(row);
  }),
);

adminRouter.patch(
  '/site-content/:blockId',
  validateBody(contentBlockPatchSchema),
  asyncHandler(async (req, res) => {
    const row = await adminService.patchContentBlock(req.params.blockId, req.user.id, req.validatedBody);
    res.json(row);
  }),
);

adminRouter.post(
  '/site-content/:blockId/rollback',
  validateBody(rollbackSchema),
  asyncHandler(async (req, res) => {
    const row = await adminService.rollbackContentBlock(req.params.blockId, req.validatedBody.versionId, req.user.id);
    res.json(row);
  }),
);

adminRouter.get(
  '/audit-events',
  asyncHandler(async (req, res) => {
    const action = req.query.action ? String(req.query.action) : undefined;
    const entityType = req.query.entityType ? String(req.query.entityType) : undefined;
    const actorId = req.query.actorId ? String(req.query.actorId) : undefined;
    const from = req.query.from ? String(req.query.from) : undefined;
    const to = req.query.to ? String(req.query.to) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const rows = await adminService.listAdminAuditEvents({ action, entityType, actorId, from, to, limit });
    res.json(rows);
  }),
);

adminRouter.get(
  '/site-items',
  asyncHandler(async (req, res) => {
    const kind = req.query.kind ? String(req.query.kind) : undefined;
    res.json(await adminService.listCmsSiteItems({ kind }));
  }),
);

adminRouter.post(
  '/site-items',
  validateBody(cmsItemSchema),
  asyncHandler(async (req, res) => {
    const row = await adminService.createCmsSiteItem(req.user.id, req.validatedBody);
    invalidatePublicSiteItemsCache();
    res.status(201).json(row);
  }),
);

adminRouter.patch(
  '/site-items/:itemId',
  validateBody(cmsItemSchema),
  asyncHandler(async (req, res) => {
    const row = await adminService.updateCmsSiteItem(req.params.itemId, req.user.id, req.validatedBody);
    invalidatePublicSiteItemsCache();
    res.json(row);
  }),
);

adminRouter.delete(
  '/site-items/:itemId',
  asyncHandler(async (req, res) => {
    await adminService.deleteCmsSiteItem(req.params.itemId, req.user.id);
    invalidatePublicSiteItemsCache();
    res.status(204).send();
  }),
);

adminRouter.post(
  '/site-items/reorder',
  validateBody(cmsReorderSchema),
  asyncHandler(async (req, res) => {
    const rows = await adminService.reorderCmsSiteItems(req.user.id, req.validatedBody.kind, req.validatedBody.ids);
    invalidatePublicSiteItemsCache();
    res.json(rows);
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
}
