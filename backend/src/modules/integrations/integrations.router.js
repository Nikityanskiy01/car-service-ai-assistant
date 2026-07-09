import { Router } from 'express';
import { z } from 'zod';
import { authJwt } from '../../middleware/authJwt.js';
import { requireRole } from '../../middleware/requireRole.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { validateBody, validateQuery } from '../../middleware/validate.js';
import * as integrationsService from './integrations.service.js';
import { INTEGRATION_CONNECTION_STATUS, INTEGRATION_JOB_STATUS, INTEGRATION_PROVIDERS } from './integration.constants.js';

const connectionCreateSchema = z.object({
  name: z.string().min(2).max(120),
  provider: z.enum(INTEGRATION_PROVIDERS),
  versionLabel: z.string().max(120).optional(),
  mode: z.string().min(1).max(60).optional(),
  config: z.record(z.unknown()).optional(),
  credentials: z.record(z.string()).optional(),
});

const connectionPatchSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  versionLabel: z.string().max(120).optional().nullable(),
  mode: z.string().min(1).max(60).optional(),
  config: z.record(z.unknown()).optional(),
  credentials: z.record(z.string()).optional(),
});

const resolveConflictSchema = z.object({
  resolution: z.enum(['KEEP_LOCAL', 'ACCEPT_EXTERNAL', 'MERGE', 'POSTPONE']),
  note: z.string().max(500).optional(),
});

const jobsQuerySchema = z.object({
  status: z.enum(INTEGRATION_JOB_STATUS).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
});

const integrationQuerySchema = z.object({
  status: z.enum(INTEGRATION_CONNECTION_STATUS).optional(),
});

export const integrationsAdminRouter = Router();
integrationsAdminRouter.use(authJwt);
integrationsAdminRouter.use(requireRole('ADMINISTRATOR'));

integrationsAdminRouter.get(
  '/integrations',
  validateQuery(integrationQuerySchema),
  asyncHandler(async (req, res) => {
    const rows = await integrationsService.listConnections();
    const items = req.validatedQuery.status ? rows.filter((x) => x.status === req.validatedQuery.status) : rows;
    res.json(items);
  }),
);

integrationsAdminRouter.post(
  '/integrations',
  validateBody(connectionCreateSchema),
  asyncHandler(async (req, res) => {
    const row = await integrationsService.createConnection(req.validatedBody);
    res.status(201).json(row);
  }),
);

integrationsAdminRouter.get(
  '/integrations/:id',
  asyncHandler(async (req, res) => {
    const rows = await integrationsService.listConnections();
    const row = rows.find((x) => x.id === req.params.id);
    if (!row) return res.status(404).json({ error: 'Подключение не найдено', code: 'NOT_FOUND' });
    res.json(row);
  }),
);

integrationsAdminRouter.patch(
  '/integrations/:id',
  validateBody(connectionPatchSchema),
  asyncHandler(async (req, res) => {
    const row = await integrationsService.patchConnection(req.params.id, req.validatedBody);
    res.json(row);
  }),
);

integrationsAdminRouter.delete(
  '/integrations/:id',
  asyncHandler(async (req, res) => {
    await integrationsService.deleteConnection(req.params.id);
    res.status(204).send();
  }),
);

integrationsAdminRouter.post(
  '/integrations/:id/test',
  asyncHandler(async (req, res) => {
    const out = await integrationsService.testConnection(req.params.id);
    res.json(out);
  }),
);

integrationsAdminRouter.post(
  '/integrations/:id/enable',
  asyncHandler(async (req, res) => {
    const row = await integrationsService.setConnectionEnabled(req.params.id, true);
    res.json(row);
  }),
);

integrationsAdminRouter.post(
  '/integrations/:id/disable',
  asyncHandler(async (req, res) => {
    const row = await integrationsService.setConnectionEnabled(req.params.id, false);
    res.json(row);
  }),
);

integrationsAdminRouter.post(
  '/integrations/:id/sync',
  asyncHandler(async (req, res) => {
    const dispatched = await integrationsService.dispatchOutbox(req.params.id);
    const processed = await integrationsService.processPendingJobs();
    res.json({ dispatched, processed });
  }),
);

integrationsAdminRouter.get(
  '/integrations/:id/capabilities',
  asyncHandler(async (req, res) => {
    res.json(await integrationsService.getCapabilities(req.params.id));
  }),
);

integrationsAdminRouter.get(
  '/integrations/:id/jobs',
  validateQuery(jobsQuerySchema),
  asyncHandler(async (req, res) => {
    const out = await integrationsService.listJobs(req.params.id, req.validatedQuery);
    res.json(out);
  }),
);

integrationsAdminRouter.get(
  '/integrations/:id/logs',
  asyncHandler(async (req, res) => {
    res.json(await integrationsService.listAuditLogs(req.params.id));
  }),
);

integrationsAdminRouter.get(
  '/integrations/:id/conflicts',
  asyncHandler(async (req, res) => {
    res.json(await integrationsService.listConflicts(req.params.id));
  }),
);

integrationsAdminRouter.post(
  '/integration-jobs/:jobId/retry',
  asyncHandler(async (req, res) => {
    const out = await integrationsService.retryJob(req.params.jobId);
    res.json(out);
  }),
);

integrationsAdminRouter.post(
  '/integration-jobs/:jobId/cancel',
  asyncHandler(async (req, res) => {
    await integrationsService.cancelJob(req.params.jobId);
    res.status(204).send();
  }),
);

integrationsAdminRouter.post(
  '/integration-conflicts/:id/resolve',
  validateBody(resolveConflictSchema),
  asyncHandler(async (req, res) => {
    const out = await integrationsService.resolveConflict(
      req.params.id,
      req.validatedBody.resolution,
      req.validatedBody.note,
    );
    res.json(out);
  }),
);

export const integrationsPublicWebhookRouter = Router();
integrationsPublicWebhookRouter.post(
  '/integrations/:connectionId',
  asyncHandler(async (req, res) => {
    const out = await integrationsService.handleIncomingWebhook(req.params.connectionId, req.body || null, req.headers);
    res.status(202).json({
      id: out.id,
      status: 'accepted',
      message: 'Webhook принят в очередь обработки',
    });
  }),
);

export const integrationsManagerRouter = Router();
integrationsManagerRouter.use(authJwt);
integrationsManagerRouter.use(requireRole('MANAGER', 'ADMINISTRATOR'));

integrationsManagerRouter.get(
  '/requests/:requestId/integrations',
  asyncHandler(async (req, res) => {
    const out = await integrationsService.getRequestIntegrationStatus(req.params.requestId);
    res.json(out);
  }),
);

integrationsManagerRouter.post(
  '/requests/:requestId/export',
  asyncHandler(async (req, res) => {
    const connectionId = String(req.body?.connectionId || '');
    if (!connectionId) {
      return res.status(400).json({
        error: 'Выберите подключение для передачи заявки',
        code: 'BAD_REQUEST',
      });
    }
    const out = await integrationsService.exportRequestToConnection(req.params.requestId, connectionId);
    res.json(out);
  }),
);

integrationsManagerRouter.post(
  '/requests/:requestId/integrations/:connectionId/retry',
  asyncHandler(async (req, res) => {
    const out = await integrationsService.exportRequestToConnection(req.params.requestId, req.params.connectionId);
    res.json(out);
  }),
);
