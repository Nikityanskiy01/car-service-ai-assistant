import { Router } from 'express';
import { z } from 'zod';
import { authJwt } from '../../middleware/authJwt.js';
import { requireRole } from '../../middleware/requireRole.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { validateBody, validateQuery } from '../../middleware/validate.js';
import * as serviceRequestsService from './serviceRequests.service.js';
import { buildServiceRequestPdfBuffer } from '../../lib/pdf/serviceRequestPdf.js';

const listQuerySchema = z.object({
  status: z.enum(['NEW', 'IN_PROGRESS', 'SCHEDULED', 'COMPLETED', 'CANCELLED']).optional(),
  q: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
  sort: z.enum(['createdAt', 'client', 'car', 'status', 'version']).optional().default('createdAt'),
  dir: z.enum(['asc', 'desc']).optional().default('desc'),
});

const patchSchema = z.object({
  status: z.enum(['NEW', 'IN_PROGRESS', 'SCHEDULED', 'COMPLETED', 'CANCELLED']),
  expectedVersion: z.number().int(),
});

export const serviceRequestsRouter = Router();
serviceRequestsRouter.use(authJwt);

serviceRequestsRouter.get(
  '/',
  validateQuery(listQuerySchema),
  asyncHandler(async (req, res) => {
    const { status, q, page, pageSize, sort, dir } = req.validatedQuery;
    const out = await serviceRequestsService.listRequests(req.user, {
      status,
      q,
      page,
      pageSize,
      sort,
      dir,
    });
    res.json({
      items: out.items.map(serializeListItem),
      total: out.total,
      page: out.page,
      pageSize: out.pageSize,
    });
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

function serializeListItem(r) {
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
    client: r.client,
  };
}

function serializeDetail(r) {
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
    consultationSession: r.consultationSession
      ? {
          id: r.consultationSession.id,
          status: r.consultationSession.status,
          progressPercent: r.consultationSession.progressPercent,
          messages: r.consultationSession.messages?.map((m) => ({
            id: m.id,
            sender: m.sender,
            content: m.content,
            createdAt: m.createdAt.toISOString(),
          })),
          extracted: r.consultationSession.extracted,
          recommendations: r.consultationSession.recommendations,
        }
      : undefined,
  };
}
