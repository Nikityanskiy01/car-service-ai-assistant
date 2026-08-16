import { Router } from 'express';
import { authJwt } from '../../middleware/authJwt.js';
import { requireRole } from '../../middleware/requireRole.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { validateBody, validateQuery } from '../../middleware/validate.js';
import * as serviceRequestsService from './serviceRequests.service.js';
import * as consultationFeedbackService from '../../services/consultationFeedback.service.js';
import * as completionDocumentsService from '../completionDocuments/completionDocuments.service.js';
import { buildServiceRequestPdfBuffer } from '../../lib/pdf/serviceRequestPdf.js';
import { listUnreadThreadsForClient } from '../requestMessages/requestMessages.service.js';
import { contentDisposition, isInlineSafeImage } from '../../lib/fileMagic.js';
import {
  listQuerySchema,
  patchSchema,
  bulkPatchSchema,
  bulkAssignSchema,
  assignManagerSchema,
  bulkExportSchema,
  feedbackSchema,
  completionDocumentSchema,
  clientsQuerySchema,
  boardQuerySchema,
} from './serviceRequests.schemas.js';
import { serializeListItem, serializeDetail } from './serviceRequests.serialize.js';

export const serviceRequestsRouter = Router();
serviceRequestsRouter.use(authJwt);

serviceRequestsRouter.get(
  '/',
  validateQuery(listQuerySchema),
  asyncHandler(async (req, res) => {
    const { status, q, page, pageSize, sort, dir, mine, sla, feedback, urgency, statuses, source, period, hasDiagnosis, cursor } =
      req.validatedQuery;
    const statusList = statuses
      ? String(statuses)
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined;
    const out = await serviceRequestsService.listRequests(req.user, {
      status,
      statuses: statusList,
      q,
      page,
      pageSize,
      sort,
      dir,
      mine,
      sla,
      feedback,
      urgency,
      source,
      period,
      hasDiagnosis,
      cursor,
    });
    let items = out.items.map(serializeListItem);
    if (req.user.role === 'CLIENT') {
      const { threads } = await listUnreadThreadsForClient(req.user.id);
      const unreadByRequestId = new Map(threads.map((thread) => [thread.requestId, thread.unreadCount]));
      items = items.map((item) => ({
        ...item,
        unreadCount: unreadByRequestId.get(item.id) || 0,
      }));
    }
    res.json({
      items,
      total: out.total,
      page: out.page,
      pageSize: out.pageSize,
      nextCursor: out.nextCursor || null,
    });
  }),
);

serviceRequestsRouter.get(
  '/managers',
  requireRole('MANAGER', 'ADMINISTRATOR'),
  asyncHandler(async (_req, res) => {
    res.json(await serviceRequestsService.listStaffManagers());
  }),
);

serviceRequestsRouter.get(
  '/clients',
  requireRole('MANAGER', 'ADMINISTRATOR'),
  validateQuery(clientsQuerySchema),
  asyncHandler(async (req, res) => {
    res.json(await serviceRequestsService.listClients(req.user, req.validatedQuery));
  }),
);

serviceRequestsRouter.get(
  '/board',
  requireRole('MANAGER', 'ADMINISTRATOR'),
  validateQuery(boardQuerySchema),
  asyncHandler(async (req, res) => {
    const { status, q, pageSize, sort, dir, mine, sla, feedback, urgency, statuses, source, period, hasDiagnosis } =
      req.validatedQuery;
    const statusList = statuses
      ? String(statuses)
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined;
    const out: any = await serviceRequestsService.listBoard(req.user, {
      status,
      statuses: statusList,
      q,
      pageSize,
      sort,
      dir,
      mine,
      sla,
      feedback,
      urgency,
      source,
      period,
      hasDiagnosis,
    });
    const columns: any = {};
    for (const [columnStatus, column] of Object.entries(out.columns || {}) as [string, any][]) {
      columns[columnStatus] = {
        ...column,
        items: column.items.map(serializeListItem),
      };
    }
    res.json({ columns, total: out.total });
  }),
);

serviceRequestsRouter.get(
  '/:requestId/export.pdf',
  asyncHandler(async (req, res) => {
    const buf = await buildServiceRequestPdfBuffer(req.params.requestId, req.user);
    const short = req.params.requestId.slice(0, 8);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="zayavka-${short}.pdf"`);
    res.send(buf);
  }),
);

serviceRequestsRouter.get(
  '/:requestId',
  asyncHandler(async (req, res) => {
    const row = await serviceRequestsService.getRequest(req.params.requestId, req.user);
    res.json(serializeDetail(row));
  }),
);

serviceRequestsRouter.patch(
  '/:requestId',
  requireRole('MANAGER', 'ADMINISTRATOR'),
  validateBody(patchSchema),
  asyncHandler(async (req, res) => {
    const row = await serviceRequestsService.patchRequestStatus(
      req.params.requestId,
      req.user,
      req.validatedBody,
    );
    res.json({
      id: row.id,
      status: row.status,
      version: row.version,
    });
  }),
);

serviceRequestsRouter.post(
  '/bulk/status',
  requireRole('MANAGER', 'ADMINISTRATOR'),
  validateBody(bulkPatchSchema),
  asyncHandler(async (req, res) => {
    res.json(await serviceRequestsService.bulkPatchStatuses(req.user, req.validatedBody));
  }),
);

serviceRequestsRouter.post(
  '/bulk/assign',
  requireRole('MANAGER', 'ADMINISTRATOR'),
  validateBody(bulkAssignSchema),
  asyncHandler(async (req, res) => {
    res.json(await serviceRequestsService.bulkAssignToManager(req.user, req.validatedBody));
  }),
);

serviceRequestsRouter.post(
  '/bulk/export-crm',
  requireRole('MANAGER', 'ADMINISTRATOR'),
  validateBody(bulkExportSchema),
  asyncHandler(async (req, res) => {
    res.json(await serviceRequestsService.bulkExportToCrm(req.user, req.validatedBody));
  }),
);

serviceRequestsRouter.get(
  '/activity',
  requireRole('MANAGER', 'ADMINISTRATOR'),
  asyncHandler(async (req, res) => {
    const limit = req.query.limit != null ? Number(req.query.limit) : 15;
    res.json(await serviceRequestsService.listActivity(req.user, { limit }));
  }),
);

serviceRequestsRouter.get(
  '/guest-dossier/:phone',
  requireRole('MANAGER', 'ADMINISTRATOR'),
  asyncHandler(async (req, res) => {
    res.json(await serviceRequestsService.getGuestDossier(req.user, req.params.phone));
  }),
);

serviceRequestsRouter.post(
  '/:requestId/assign-to-me',
  requireRole('MANAGER', 'ADMINISTRATOR'),
  asyncHandler(async (req, res) => {
    const row = await serviceRequestsService.assignRequestToManager(req.params.requestId, req.user);
    res.json({
      id: row.id,
      assignedManagerId: row.assignedManagerId,
      assignedManager: row.assignedManager,
      version: row.version,
    });
  }),
);

serviceRequestsRouter.patch(
  '/:requestId/assign-manager',
  requireRole('MANAGER', 'ADMINISTRATOR'),
  validateBody(assignManagerSchema),
  asyncHandler(async (req, res) => {
    const row = await serviceRequestsService.assignRequestToManagerId(
      req.params.requestId,
      req.user,
      req.validatedBody.managerId,
    );
    res.json({
      id: row.id,
      assignedManagerId: row.assignedManagerId,
      assignedManager: row.assignedManager,
      version: row.version,
    });
  }),
);

serviceRequestsRouter.get(
  '/client-dossier/:clientId',
  requireRole('MANAGER', 'ADMINISTRATOR'),
  asyncHandler(async (req, res) => {
    res.json(await serviceRequestsService.getClientDossier(req.user, req.params.clientId));
  }),
);

serviceRequestsRouter.get(
  '/:requestId/status-history',
  requireRole('MANAGER', 'ADMINISTRATOR'),
  asyncHandler(async (req, res) => {
    res.json(await serviceRequestsService.getStatusHistory(req.user, req.params.requestId));
  }),
);

serviceRequestsRouter.get(
  '/:requestId/similar-cases',
  requireRole('MANAGER', 'ADMINISTRATOR'),
  asyncHandler(async (req, res) => {
    res.json(await serviceRequestsService.getSimilarCasesForRequest(req.user, req.params.requestId));
  }),
);

serviceRequestsRouter.get(
  '/:requestId/consultation-feedback',
  requireRole('MANAGER', 'ADMINISTRATOR'),
  asyncHandler(async (req, res) => {
    res.json(await consultationFeedbackService.getFeedbackForRequest(req.params.requestId));
  }),
);

serviceRequestsRouter.put(
  '/:requestId/consultation-feedback',
  requireRole('MANAGER', 'ADMINISTRATOR'),
  validateBody(feedbackSchema),
  asyncHandler(async (req, res) => {
    res.json(
      await consultationFeedbackService.upsertFeedbackForRequest(
        req.params.requestId,
        req.user.id,
        req.validatedBody,
      ),
    );
  }),
);

serviceRequestsRouter.get(
  '/:requestId/completion-documents',
  asyncHandler(async (req, res) => {
    res.json(await completionDocumentsService.listCompletionDocuments(req.params.requestId, req.user));
  }),
);

serviceRequestsRouter.post(
  '/:requestId/completion-documents',
  requireRole('MANAGER', 'ADMINISTRATOR'),
  validateBody(completionDocumentSchema),
  asyncHandler(async (req, res) => {
    const doc = await completionDocumentsService.uploadCompletionDocument(
      req.params.requestId,
      req.user,
      req.validatedBody,
    );
    res.status(201).json(doc);
  }),
);

serviceRequestsRouter.get(
  '/:requestId/completion-documents/:documentId',
  asyncHandler(async (req, res) => {
    const file = await completionDocumentsService.getCompletionDocumentFile(
      req.params.requestId,
      req.params.documentId,
      req.user,
    );
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', contentDisposition(file.fileName, { inline: isInlineSafeImage(file.mimeType) }));
    res.send(file.buffer);
  }),
);

serviceRequestsRouter.delete(
  '/:requestId/completion-documents/:documentId',
  requireRole('MANAGER', 'ADMINISTRATOR'),
  asyncHandler(async (req, res) => {
    res.json(
      await completionDocumentsService.deleteCompletionDocument(
        req.params.requestId,
        req.params.documentId,
        req.user,
      ),
    );
  }),
);
