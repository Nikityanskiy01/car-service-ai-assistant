import { Router } from 'express';
import { authJwt } from '../../middleware/authJwt.js';
import { requireRole } from '../../middleware/requireRole.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { validateBody } from '../../middleware/validate.js';
import { readCookieValue } from '../../lib/authCookies.js';
import * as adminService from './admin.service.js';
import * as adminAiMemoryService from './adminAiMemory.service.js';
import * as siteSettingsService from './siteSettings.service.js';
import { invalidatePublicSiteItemsCache } from '../content/content.router.js';
import { getLlmStatus } from '../../services/llmStatus.service.js';
import { logger } from '../../lib/logger.js';
import {
  roleSchema,
  siteSettingsPatchSchema,
  memorySearchSchema,
  memoryBackfillSchema,
  contentBlockCreateSchema,
  contentBlockPatchSchema,
  rollbackSchema,
  cmsItemSchema,
  cmsReorderSchema,
} from './admin.schemas.js';
import { registerAdminReferenceRoutes } from './admin.reference.routes.js';

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
  asyncHandler(async (req, res) => {
    const q = req.query.q ? String(req.query.q) : undefined;
    const role = req.query.role ? String(req.query.role) : undefined;
    const blocked =
      req.query.blocked === 'true' ? true : req.query.blocked === 'false' ? false : undefined;
    const users = await adminService.listUsers({ q, role, blocked });
    res.json(users);
  }),
);

adminRouter.patch(
  '/users/:userId/role',
  validateBody(roleSchema),
  asyncHandler(async (req, res) => {
    const u = await adminService.patchUserRole(req.params.userId, req.validatedBody.role, req.user.id);
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
    await adminService.blockUser(req.params.userId, req.user.id);
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
    await adminService.unblockUser(req.params.userId, req.user.id);
    logger.info(
      { action: 'UNBLOCK_USER', adminId: req.user.id, targetUserId: req.params.userId },
      'audit: admin unblocked user',
    );
    res.status(204).send();
  }),
);

adminRouter.get(
  '/sessions',
  asyncHandler(async (req, res) => {
    res.json(
      await adminService.listAdminSessions({
        refreshToken: readCookieValue(req, 'refresh') || null,
        sessionId: req.user.sessionId || null,
      }),
    );
  }),
);

adminRouter.delete(
  '/sessions/:sessionId',
  asyncHandler(async (req, res) => {
    const out = await adminService.revokeAdminSession(req.params.sessionId, req.user.id);
    res.json(out);
  }),
);

adminRouter.post(
  '/users/:userId/revoke-sessions',
  asyncHandler(async (req, res) => {
    const out = await adminService.revokeAdminUserSessions(req.params.userId, req.user.id);
    res.json(out);
  }),
);

registerAdminReferenceRoutes(adminRouter);
