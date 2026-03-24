import { Router } from 'express';
import { z } from 'zod';
import { authJwt } from '../../middleware/authJwt.js';
import { requireRole } from '../../middleware/requireRole.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { validateBody } from '../../middleware/validate.js';
import * as serviceRequestsService from './serviceRequests.service.js';

const patchSchema = z.object({
  status: z.enum(['NEW', 'IN_PROGRESS', 'SCHEDULED', 'COMPLETED', 'CANCELLED']),
  expectedVersion: z.number().int(),
});

export const serviceRequestsRouter = Router();
serviceRequestsRouter.use(authJwt);

serviceRequestsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const list = await serviceRequestsService.listRequests(req.user, {
      status: req.query.status,
      q: req.query.q,
    });
    res.json(list.map(serializeListItem));
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
