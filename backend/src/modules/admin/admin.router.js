import { Router } from 'express';
import { z } from 'zod';
import { authJwt } from '../../middleware/authJwt.js';
import { requireRole } from '../../middleware/requireRole.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { validateBody } from '../../middleware/validate.js';
import * as adminService from './admin.service.js';
import * as adminAiMemoryService from './adminAiMemory.service.js';
import * as siteSettingsService from './siteSettings.service.js';
import * as referenceService from '../reference/reference.service.js';
import { getLlmStatus } from '../../services/llmStatus.service.js';
import { logger } from '../../lib/logger.js';

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

const contentBlockCreateSchema = z.object({
  key: z.string().min(3).max(100),
  title: z.string().min(1).max(200),
  section: z.string().min(1).max(120).optional(),
  content: z.string().min(1),
});

const contentBlockPatchSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    section: z.string().min(1).max(120).optional(),
    content: z.string().min(1).optional(),
    isPublished: z.boolean().optional(),
    note: z.string().max(240).optional(),
  })
  .refine((o) => o.title != null || o.section != null || o.content != null || o.isPublished != null, {
    message: 'At least one field required',
  });

const rollbackSchema = z.object({
  versionId: z.string().uuid(),
});

const cmsItemSchema = z.object({
  kind: z.enum(['service', 'work', 'gallery']),
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  price: z.string().max(120).optional(),
  category: z.string().max(120).optional(),
  imageUrl: z
    .union([
      z.literal(''),
      z
        .string()
        .url()
        .max(2000)
        .refine((u) => /^https:/i.test(u), { message: 'imageUrl must be https://' }),
    ])
    .optional(),
  problem: z.string().max(2000).optional(),
  result: z.string().max(2000).optional(),
  term: z.string().max(200).optional(),
  published: z.boolean().optional(),
  orderIndex: z.number().int().nonnegative().optional(),
});

const cmsReorderSchema = z.object({
  kind: z.enum(['service', 'work', 'gallery']),
  ids: z.array(z.string().uuid()).min(1),
});

const memorySearchSchema = z.object({
  symptoms: z.string().min(1).max(4000),
  make: z.string().max(120).optional(),
  model: z.string().max(120).optional(),
  conditions: z.string().max(4000).optional(),
  limit: z.number().int().min(1).max(20).optional(),
});

const memoryBackfillSchema = z.object({
  limit: z.number().int().min(1).max(2000).optional(),
  dryRun: z.boolean().optional(),
});

const siteSettingsPatchSchema = z
  .object({
    productName: z.string().min(1).max(200).optional(),
    shortName: z.string().min(1).max(80).optional(),
    description: z.string().max(500).optional(),
    logoUrl: z.union([z.literal(''), z.string().url().max(2000)]).optional().nullable(),
    supportEmail: z.union([z.literal(''), z.string().email().max(200)]).optional().nullable(),
    phone: z.string().max(40).optional().nullable(),
    address: z.string().max(300).optional().nullable(),
    workingHours: z.string().max(120).optional(),
    mapUrl: z.union([z.literal(''), z.string().url().max(2000)]).optional().nullable(),
    assistantName: z.string().min(1).max(120).optional(),
    footerCaption: z.string().max(300).optional(),
    theme: z
      .object({
        primary: z.string().max(20).optional(),
        secondary: z.string().max(20).optional(),
        accent: z.string().max(20).optional(),
      })
      .optional(),
    legal: z
      .object({
        legalName: z.string().max(300).optional(),
        ogrn: z.string().max(20).optional(),
        inn: z.string().max(20).optional(),
        legalAddress: z.string().max(300).optional(),
        privacyEmail: z.union([z.literal(''), z.string().email().max(200)]).optional(),
      })
      .optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: 'At least one field required' });

export const adminRouter = Router();
adminRouter.use(authJwt);
adminRouter.use(requireRole('ADMINISTRATOR'));

adminRouter.get(
  '/llm-status',
  asyncHandler(async (req, res) => {
    const probe = String(req.query.probe || '').toLowerCase() === 'true';
    const status = await getLlmStatus({ probe });
    res.json(status);
  }),
);

adminRouter.get(
  '/llm-eval',
  asyncHandler(async (_req, res) => {
    const { runConsultationEval } = await import('../eval/consultationEval.service.js');
    const report = runConsultationEval();
    res.json({
      ok: report.ok,
      total: report.total,
      passed: report.passed,
      failedCount: report.failed.length,
      promptOk: !report.promptIssues?.length,
      checkedAt: report.checkedAt,
      failed: report.failed.slice(0, 5),
    });
  }),
);

adminRouter.get(
  '/ai/memory/stats',
  asyncHandler(async (_req, res) => {
    res.json(await adminAiMemoryService.getCaseMemoryStats());
  }),
);

adminRouter.post(
  '/ai/memory/search',
  validateBody(memorySearchSchema),
  asyncHandler(async (req, res) => {
    res.json(await adminAiMemoryService.searchCaseMemory(req.validatedBody));
  }),
);

adminRouter.post(
  '/ai/memory/backfill',
  validateBody(memoryBackfillSchema),
  asyncHandler(async (req, res) => {
    const result = await adminAiMemoryService.runCaseMemoryBackfill(req.validatedBody);
    logger.info({ action: 'CASE_MEMORY_BACKFILL', adminId: req.user.id, ...result }, 'admin case memory backfill');
    res.json(result);
  }),
);

adminRouter.get(
  '/site-settings',
  asyncHandler(async (_req, res) => {
    res.json(await siteSettingsService.getSiteSettings());
  }),
);

adminRouter.patch(
  '/site-settings',
  validateBody(siteSettingsPatchSchema),
  asyncHandler(async (req, res) => {
    siteSettingsService.validateSiteSettingsPatch(req.validatedBody);
    res.json(await siteSettingsService.patchSiteSettings(req.user.id, req.validatedBody));
  }),
);

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
    logger.info(
      { action: 'CHANGE_ROLE', adminId: req.user.id, targetUserId: req.params.userId, newRole: req.validatedBody.role },
      'audit: admin changed user role',
    );
    res.json(u);
  }),
);

adminRouter.post(
  '/users/:userId/block',
  asyncHandler(async (req, res) => {
    await adminService.blockUser(req.params.userId);
    logger.info(
      { action: 'BLOCK_USER', adminId: req.user.id, targetUserId: req.params.userId },
      'audit: admin blocked user',
    );
    res.status(204).send();
  }),
);

adminRouter.post(
  '/users/:userId/unblock',
  asyncHandler(async (req, res) => {
    await adminService.unblockUser(req.params.userId);
    logger.info(
      { action: 'UNBLOCK_USER', adminId: req.user.id, targetUserId: req.params.userId },
      'audit: admin unblocked user',
    );
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
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const rows = await adminService.listAdminAuditEvents({ action, entityType, limit });
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
    res.status(201).json(row);
  }),
);

adminRouter.patch(
  '/site-items/:itemId',
  validateBody(cmsItemSchema),
  asyncHandler(async (req, res) => {
    const row = await adminService.updateCmsSiteItem(req.params.itemId, req.user.id, req.validatedBody);
    res.json(row);
  }),
);

adminRouter.delete(
  '/site-items/:itemId',
  asyncHandler(async (req, res) => {
    await adminService.deleteCmsSiteItem(req.params.itemId, req.user.id);
    res.status(204).send();
  }),
);

adminRouter.post(
  '/site-items/reorder',
  validateBody(cmsReorderSchema),
  asyncHandler(async (req, res) => {
    const rows = await adminService.reorderCmsSiteItems(req.user.id, req.validatedBody.kind, req.validatedBody.ids);
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
