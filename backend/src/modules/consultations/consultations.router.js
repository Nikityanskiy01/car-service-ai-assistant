import { Router } from 'express';
import { z } from 'zod';
import { authJwt, optionalAuthJwt } from '../../middleware/authJwt.js';
import { requireRole } from '../../middleware/requireRole.js';
import {
  consultationSessionAccess,
  blockStaffFromPosting,
} from '../../middleware/consultationAccess.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { validateBody } from '../../middleware/validate.js';
import { isAppError } from '../../lib/errors.js';
import * as consultationsService from './consultations.service.js';
import * as serviceRequestsService from '../serviceRequests/serviceRequests.service.js';
import * as referenceService from '../reference/reference.service.js';

const messageSchema = z.object({
  content: z.string().min(1),
});

const reportSchema = z.object({
  label: z.string().optional(),
});

const claimSchema = z.object({
  guestToken: z.string().min(16),
});

const guestRequestSchema = z.object({
  fullName: z.string().min(2).max(120),
  phone: z.string().min(6).max(40),
  email: z.string().email().optional().nullable(),
});

export const consultationsRouter = Router();

consultationsRouter.post(
  '/',
  optionalAuthJwt,
  asyncHandler(async (req, res) => {
    if (req.user?.role === 'CLIENT') {
      const session = await consultationsService.createSessionForClient(req.user.id, req.body || {});
      res.status(201).json(serializeSession(session, { isGuest: false }));
      return;
    }
    if (!req.user) {
      const { session, guestToken } = await consultationsService.createGuestSession(req.body || {});
      res.status(201).json({ ...serializeSession(session, { isGuest: true }), guestToken });
      return;
    }
    res.status(403).json({ error: 'Консультацию может начать только клиент или гость без входа' });
  }),
);

consultationsRouter.get(
  '/context/active-templates',
  authJwt,
  requireRole('CLIENT'),
  asyncHandler(async (_req, res) => {
    const scenarios = await referenceService.listActiveTemplatesForClient();
    res.json({ scenarios });
  }),
);

consultationsRouter.get(
  '/',
  authJwt,
  requireRole('CLIENT'),
  asyncHandler(async (req, res) => {
    const list = await consultationsService.listSessions(req.user.id);
    res.json(list.map((s) => serializeSessionList(s)));
  }),
);

consultationsRouter.post(
  '/:sessionId/claim',
  authJwt,
  requireRole('CLIENT'),
  validateBody(claimSchema),
  asyncHandler(async (req, res) => {
    const session = await consultationsService.claimSession(
      req.params.sessionId,
      req.user.id,
      req.validatedBody.guestToken,
    );
    res.status(200).json(serializeSessionDetail(session));
  }),
);

consultationsRouter.get(
  '/:sessionId',
  optionalAuthJwt,
  consultationSessionAccess,
  asyncHandler(async (req, res) => {
    const session = await consultationsService.getSessionDetail(
      req.params.sessionId,
      req.consultationActor,
    );
    res.json(serializeSessionDetail(session));
  }),
);

consultationsRouter.post(
  '/:sessionId/messages',
  optionalAuthJwt,
  consultationSessionAccess,
  blockStaffFromPosting,
  validateBody(messageSchema),
  asyncHandler(async (req, res) => {
    try {
      const session = await consultationsService.postMessage(
        req.params.sessionId,
        req.consultationActor,
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
  authJwt,
  requireRole('CLIENT'),
  validateBody(reportSchema),
  asyncHandler(async (req, res) => {
    const report = await consultationsService.saveReport(
      req.params.sessionId,
      req.user.id,
      req.validatedBody,
    );
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
  authJwt,
  requireRole('CLIENT'),
  asyncHandler(async (req, res) => {
    const sr = await serviceRequestsService.createFromSession(req.params.sessionId, req.user);
    res.status(201).json(serializeServiceRequest(sr));
  }),
);

// Guest flow: allow creating a service request without registration,
// but only with a valid guest token for the consultation session.
consultationsRouter.post(
  '/:sessionId/service-request-guest',
  optionalAuthJwt,
  consultationSessionAccess,
  blockStaffFromPosting,
  validateBody(guestRequestSchema),
  asyncHandler(async (req, res) => {
    const sr = await serviceRequestsService.createFromGuestSession(
      req.params.sessionId,
      req.consultationActor,
      req.validatedBody,
    );
    res.status(201).json(serializeServiceRequest(sr));
  }),
);

function serializeSession(s, { isGuest } = {}) {
  const guest = isGuest ?? s.clientId == null;
  return {
    id: s.id,
    status: s.status,
    progressPercent: s.progressPercent,
    confidencePercent: s.confidencePercent,
    costFromMinor: s.costFromMinor,
    preliminaryNote: s.preliminaryNote,
    createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : s.createdAt,
    serviceCategoryId: s.serviceCategoryId,
    isGuest: guest,
    guestName: s.guestName || null,
    guestPhone: s.guestPhone || null,
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
