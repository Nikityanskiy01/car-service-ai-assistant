import { Router } from 'express';
import { z } from 'zod';
import { authJwt } from '../../middleware/authJwt.js';
import { requireRole } from '../../middleware/requireRole.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { validateBody } from '../../middleware/validate.js';
import { isAppError } from '../../lib/errors.js';
import * as consultationsService from './consultations.service.js';
import * as serviceRequestsService from '../serviceRequests/serviceRequests.service.js';

const messageSchema = z.object({
  content: z.string().min(1),
});

const reportSchema = z.object({
  label: z.string().optional(),
});

export const consultationsRouter = Router();
consultationsRouter.use(authJwt);

consultationsRouter.post(
  '/',
  requireRole('CLIENT'),
  asyncHandler(async (req, res) => {
    const session = await consultationsService.createSession(req.user.id, req.body || {});
    res.status(201).json(serializeSession(session));
  }),
);

consultationsRouter.get(
  '/',
  requireRole('CLIENT'),
  asyncHandler(async (req, res) => {
    const list = await consultationsService.listSessions(req.user.id);
    res.json(list.map(serializeSessionList));
  }),
);

consultationsRouter.get(
  '/:sessionId',
  asyncHandler(async (req, res) => {
    const session = await consultationsService.getSession(req.params.sessionId, req.user);
    res.json(serializeSessionDetail(session));
  }),
);

consultationsRouter.post(
  '/:sessionId/messages',
  requireRole('CLIENT'),
  validateBody(messageSchema),
  asyncHandler(async (req, res) => {
    try {
      const session = await consultationsService.postMessage(
        req.params.sessionId,
        req.user,
        req.validatedBody.content,
      );
      res.status(201).json(serializeSessionDetail(session));
    } catch (e) {
      if (isAppError(e) && (e.statusCode === 503 || e.code === 'LLM_ERROR')) {
        return res.status(503).json({
          error: e.message || 'AI module unavailable',
          code: 'LLM_ERROR',
          sessionStatus: 'AI_ERROR',
        });
      }
      throw e;
    }
  }),
);

consultationsRouter.post(
  '/:sessionId/report',
  requireRole('CLIENT'),
  validateBody(reportSchema),
  asyncHandler(async (req, res) => {
    const report = await consultationsService.saveReport(req.params.sessionId, req.user, req.validatedBody);
    res.status(201).json({
      id: report.id,
      consultationSessionId: report.consultationSessionId,
      createdAt: report.createdAt.toISOString(),
      label: report.label,
      snapshotJson: report.snapshotJson,
    });
  }),
);

consultationsRouter.post(
  '/:sessionId/service-request',
  requireRole('CLIENT'),
  asyncHandler(async (req, res) => {
    const sr = await serviceRequestsService.createFromSession(req.params.sessionId, req.user);
    res.status(201).json(serializeServiceRequest(sr));
  }),
);

function serializeSession(s) {
  return {
    id: s.id,
    status: s.status,
    progressPercent: s.progressPercent,
    confidencePercent: s.confidencePercent,
    costFromMinor: s.costFromMinor,
    preliminaryNote: s.preliminaryNote,
    createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : s.createdAt,
    serviceCategoryId: s.serviceCategoryId,
  };
}

function serializeSessionList(s) {
  return {
    ...serializeSession(s),
    extracted: s.extracted,
    serviceRequest: s.serviceRequest,
  };
}

function serializeSessionDetail(s) {
  return {
    ...serializeSession(s),
    extracted: s.extracted,
    recommendations: s.recommendations,
    messages: s.messages?.map((m) => ({
      id: m.id,
      sender: m.sender,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
    })),
    serviceRequest: s.serviceRequest,
    serviceCategory: s.serviceCategory,
  };
}

function serializeServiceRequest(sr) {
  return {
    id: sr.id,
    status: sr.status,
    version: sr.version,
    clientId: sr.clientId,
    consultationSessionId: sr.consultationSessionId,
    snapshotMake: sr.snapshotMake,
    snapshotModel: sr.snapshotModel,
    snapshotSymptoms: sr.snapshotSymptoms,
    createdAt: sr.createdAt.toISOString(),
    client: sr.client
      ? {
          id: sr.client.id,
          fullName: sr.client.fullName,
          phone: sr.client.phone,
          email: sr.client.email,
          emailProfile: sr.client.emailProfile,
        }
      : undefined,
    consultationSession: sr.consultationSession,
  };
}
