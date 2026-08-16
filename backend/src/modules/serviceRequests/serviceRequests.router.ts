import { Router } from 'express';
import { z } from 'zod';
import { authJwt } from '../../middleware/authJwt.js';
import { requireRole } from '../../middleware/requireRole.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { validateBody, validateQuery } from '../../middleware/validate.js';
import * as serviceRequestsService from './serviceRequests.service.js';
import * as consultationFeedbackService from '../../services/consultationFeedback.service.js';
import * as completionDocumentsService from '../completionDocuments/completionDocuments.service.js';
import { buildServiceRequestPdfBuffer } from '../../lib/pdf/serviceRequestPdf.js';
import { isSlaBreached } from '../../lib/requestSla.js';
import { listUnreadThreadsForClient } from '../requestMessages/requestMessages.service.js';
import { contentDisposition, isInlineSafeImage } from '../../lib/fileMagic.js';

const listQuerySchema = z.object({
  status: z.enum(['NEW', 'IN_PROGRESS', 'SCHEDULED', 'COMPLETED', 'CANCELLED']).optional(),
  q: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
  sort: z.enum(['createdAt', 'client', 'car', 'status', 'version']).optional().default('createdAt'),
  dir: z.enum(['asc', 'desc']).optional().default('desc'),
  mine: z.enum(['true', 'false', '1', '0']).optional(),
  sla: z.enum(['breached']).optional(),
  feedback: z.enum(['none', 'CORRECT', 'PARTIAL', 'INCORRECT', 'correct', 'partial', 'incorrect']).optional(),
  urgency: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  statuses: z.string().optional(),
  source: z.enum(['guest', 'registered', 'contact']).optional(),
  period: z.enum(['today', '7d', 'all']).optional(),
  hasDiagnosis: z.enum(['true', 'false', '1', '0']).optional(),
});

const patchSchema = z.object({
  status: z.enum(['NEW', 'IN_PROGRESS', 'SCHEDULED', 'COMPLETED', 'CANCELLED']),
  expectedVersion: z.number().int(),
});

const bulkPatchSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
  status: z.enum(['NEW', 'IN_PROGRESS', 'SCHEDULED', 'COMPLETED', 'CANCELLED']),
});

const bulkAssignSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
  managerId: z.string().uuid().optional(),
});

const assignManagerSchema = z.object({
  managerId: z.string().uuid(),
});

const bulkExportSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
  connectionId: z.string().uuid().optional(),
});

const feedbackSchema = z.object({
  verdict: z.enum(['CORRECT', 'PARTIAL', 'INCORRECT']),
  actualCause: z.string().max(2000).optional(),
  worksDone: z.string().max(2000).optional(),
  repairAmountMinor: z.number().int().min(0).optional().nullable(),
  workOrderNumber: z.string().max(120).optional().nullable(),
  repairCompletedAt: z.string().datetime().optional().nullable(),
  repairMileageKm: z.number().int().min(0).max(2_000_000).optional().nullable(),
  workCategory: z
    .enum(['oil_change', 'maintenance', 'brakes', 'filters', 'tires', 'other'])
    .optional()
    .nullable(),
});

const completionDocumentSchema = z.object({
  kind: z.enum(['WORK_ORDER', 'RECEIPT', 'WARRANTY', 'ACT', 'OTHER']),
  label: z.string().max(120).optional().nullable(),
  fileName: z.string().min(1).max(200),
  mimeType: z.string().min(3).max(120),
  contentBase64: z.string().min(1).max(12_000_000),
});

export const serviceRequestsRouter = Router();
serviceRequestsRouter.use(authJwt);

serviceRequestsRouter.get(
  '/',
  validateQuery(listQuerySchema),
  asyncHandler(async (req, res) => {
    const { status, q, page, pageSize, sort, dir, mine, sla, feedback, urgency, statuses, source, period, hasDiagnosis } =
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

const clientsQuerySchema = z.object({
  q: z.string().max(200).optional(),
  filter: z.enum(['all', 'active', 'guests']).optional().default('all'),
  sort: z.enum(['activity', 'recent', 'name']).optional().default('activity'),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
});

serviceRequestsRouter.get(
  '/clients',
  requireRole('MANAGER', 'ADMINISTRATOR'),
  validateQuery(clientsQuerySchema),
  asyncHandler(async (req, res) => {
    res.json(await serviceRequestsService.listClients(req.user, req.validatedQuery));
  }),
);

const boardQuerySchema = listQuerySchema.omit({ page: true, pageSize: true }).extend({
  pageSize: z.coerce.number().int().min(1).max(50).optional().default(20),
});

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

function serializeListItem(r) {
  const flowState = r.consultationSession?.flowState;
  const flow =
    flowState && typeof flowState === 'object' && !Array.isArray(flowState) ? flowState : {};
  const diagnosis =
    flow.diagnosis ?? null;

  return {
    id: r.id,
    status: r.status,
    version: r.version,
    clientId: r.clientId,
    guestName: r.guestName,
    guestPhone: r.guestPhone,
    createdAt: r.createdAt.toISOString(),
    snapshotMake: r.snapshotMake,
    snapshotModel: r.snapshotModel,
    snapshotSymptoms: r.snapshotSymptoms,
    vehicleId: r.vehicleId ?? null,
    client: r.client,
    assignedManagerId: r.assignedManagerId,
    assignedManager: r.assignedManager,
    firstResponseAt: r.firstResponseAt?.toISOString?.() ?? null,
    slaBreached: isSlaBreached({ ...r, createdAt: r.createdAt.toISOString() }),
    consultationSession: r.consultationSession
      ? {
          id: r.consultationSession.id,
          status: r.consultationSession.status,
          feedback: r.consultationSession.feedback
            ? {
                id: r.consultationSession.feedback.id,
                verdict: r.consultationSession.feedback.verdict,
              }
            : null,
          flowState: diagnosis ? { diagnosis } : null,
          intent: flow.intent ?? null,
          serviceType: flow.service_type ?? null,
          serviceCategoryName: r.consultationSession.serviceCategory?.name ?? null,
          confidencePercent: r.consultationSession.confidencePercent,
          diagnosis,
        }
      : undefined,
  };
}

function serializeDetail(r) {
  const flowState = r.consultationSession?.flowState;
  const diagnosis =
    flowState && typeof flowState === 'object' && !Array.isArray(flowState) && flowState.diagnosis
      ? flowState.diagnosis
      : null;

  return {
    id: r.id,
    status: r.status,
    version: r.version,
    clientId: r.clientId,
    guestName: r.guestName,
    guestPhone: r.guestPhone,
    guestEmail: r.guestEmail,
    consultationSessionId: r.consultationSessionId,
    snapshotMake: r.snapshotMake,
    snapshotModel: r.snapshotModel,
    snapshotSymptoms: r.snapshotSymptoms,
    createdAt: r.createdAt.toISOString(),
    client: r.client,
    assignedManagerId: r.assignedManagerId,
    assignedManager: r.assignedManager,
    firstResponseAt: r.firstResponseAt?.toISOString?.() ?? null,
    slaBreached: isSlaBreached({ ...r, createdAt: r.createdAt.toISOString() }),
    consultationSession: r.consultationSession
      ? {
          id: r.consultationSession.id,
          status: r.consultationSession.status,
          progressPercent: r.consultationSession.progressPercent,
          flowState: flowState && typeof flowState === 'object' ? flowState : null,
          messages: r.consultationSession.messages?.map((m) => ({
            id: m.id,
            sender: m.sender,
            content: m.content,
            createdAt: m.createdAt.toISOString(),
          })),
          extracted: r.consultationSession.extracted,
          recommendations: r.consultationSession.recommendations,
          diagnosis,
          feedback: r.consultationSession.feedback
            ? {
                id: r.consultationSession.feedback.id,
                verdict: r.consultationSession.feedback.verdict,
                actualCause: r.consultationSession.feedback.actualCause,
                worksDone: r.consultationSession.feedback.worksDone,
                repairAmountMinor: r.consultationSession.feedback.repairAmountMinor,
                workOrderNumber: r.consultationSession.feedback.workOrderNumber,
                repairCompletedAt: r.consultationSession.feedback.repairCompletedAt?.toISOString?.() ?? null,
                createdAt: r.consultationSession.feedback.createdAt.toISOString(),
                updatedAt: r.consultationSession.feedback.updatedAt.toISOString(),
                manager: r.consultationSession.feedback.manager
                  ? {
                      id: r.consultationSession.feedback.manager.id,
                      fullName: r.consultationSession.feedback.manager.fullName,
                    }
                  : undefined,
              }
            : null,
        }
      : undefined,
    bookings: (r.bookings || []).map((b) => ({
      id: b.id,
      status: b.status,
      preferredAt: b.preferredAt.toISOString(),
      notes: b.notes,
    })),
  };
}
