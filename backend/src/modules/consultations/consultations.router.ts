import { Router } from 'express';
import { authJwt, optionalAuthJwt } from '../../middleware/authJwt.js';
import { requireRole } from '../../middleware/requireRole.js';
import {
  consultationSessionAccess,
  blockStaffFromPosting,
} from '../../middleware/consultationAccess.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { createPublicWriteLimiter } from '../../middleware/publicWriteLimiter.js';
import { idempotency } from '../../middleware/idempotency.js';
import { createLlmLimiter, createVisionLimiter } from '../../middleware/rateLimitConfig.js';
import { abuseChallengeFromRequest, createAbuseChallenge, verifyAbuseChallenge } from '../../lib/guestPow.js';
import { recordConsentEvent } from '../privacy/consent.service.js';
import { validateBody, validateQuery } from '../../middleware/validate.js';
import { isAppError } from '../../lib/errors.js';
import * as consultationsService from './consultations.service.js';
import { getDiagnosisJobForSession } from '../../services/diagnosisJob.service.js';
import * as serviceRequestsService from '../serviceRequests/serviceRequests.service.js';
import * as referenceService from '../reference/reference.service.js';
import { buildConsultationPdfBuffer } from '../../lib/pdf/consultationPdf.js';
import {
  photoSchema,
  messageSchema,
  reportSchema,
  claimSchema,
  guestRequestSchema,
  staffSessionsQuerySchema,
} from './consultations.schemas.js';
import {
  serializeSession,
  serializeSessionList,
  serializeStaffSessionList,
  serializeSessionDetail,
  serializeServiceRequest,
} from './consultations.serialize.js';
import { registerConsultationsStreamRoutes } from './consultations.stream.routes.js';

export const consultationsRouter = Router();

const createSessionLimiter = createPublicWriteLimiter(40);
const llmLimiter = createLlmLimiter();
const visionLimiter = createVisionLimiter();

async function requireAbuseChallenge(req, res, next) {
  if (process.env.NODE_ENV === 'test' || req.user) return next();
  try {
    const ok = await verifyAbuseChallenge(abuseChallengeFromRequest(req));
    if (!ok) {
      return res.status(403).json({ error: 'Требуется проверка антибота', code: 'ABUSE_CHALLENGE' });
    }
    next();
  } catch (err) {
    next(err);
  }
}

consultationsRouter.get('/abuse-challenge', createSessionLimiter, (_req, res) => {
  res.json(createAbuseChallenge());
});

consultationsRouter.post(
  '/',
  createSessionLimiter,
  optionalAuthJwt,
  requireAbuseChallenge,
  idempotency(),
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

consultationsRouter.get(
  '/staff',
  authJwt,
  requireRole('MANAGER', 'ADMINISTRATOR'),
  validateQuery(staffSessionsQuerySchema),
  asyncHandler(async (req, res) => {
    const { limit, offset, cursor } = req.validatedQuery;
    const { items, total, nextCursor } = await consultationsService.listSessionsForStaff({
      limit,
      offset,
      cursor,
    });
    res.json({
      items: items.map(serializeStaffSessionList),
      total,
      limit,
      offset,
      nextCursor,
    });
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
  '/:sessionId/export.pdf',
  optionalAuthJwt,
  consultationSessionAccess,
  asyncHandler(async (req, res) => {
    const session = await consultationsService.getSessionDetail(req.params.sessionId, req.consultationActor);
    const buf = await buildConsultationPdfBuffer(session);
    const short = req.params.sessionId.slice(0, 8);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="konsultaciya-${short}.pdf"`);
    res.send(buf);
  }),
);

consultationsRouter.get(
  '/:sessionId/diagnosis-job',
  optionalAuthJwt,
  consultationSessionAccess,
  asyncHandler(async (req, res) => {
    res.json(await getDiagnosisJobForSession(req.params.sessionId));
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
  llmLimiter,
  optionalAuthJwt,
  requireAbuseChallenge,
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
          error: 'Сервис интеллектуального анализа временно недоступен. Вы можете сохранить обращение и передать его менеджеру.',
          code: 'LLM_ERROR',
          sessionStatus: 'AI_ERROR',
        });
      }
      throw e;
    }
  }),
);

consultationsRouter.post(
  '/:sessionId/analyze-photo',
  visionLimiter,
  optionalAuthJwt,
  requireAbuseChallenge,
  consultationSessionAccess,
  blockStaffFromPosting,
  validateBody(photoSchema),
  asyncHandler(async (req, res) => {
    try {
      const result = await consultationsService.analyzeConsultationPhoto(
        req.params.sessionId,
        req.consultationActor,
        req.validatedBody,
      );
      const session = await consultationsService.getSessionDetail(
        req.params.sessionId,
        req.consultationActor,
      );
      res.status(201).json({ ...result, session: serializeSessionDetail(session) });
    } catch (e) {
      if (isAppError(e) && (e.statusCode === 503 || e.code === 'LLM_ERROR')) {
        return res.status(503).json({
          error: 'Анализ фото временно недоступен. Опишите симптомы текстом.',
          code: 'LLM_ERROR',
        });
      }
      throw e;
    }
  }),
);

registerConsultationsStreamRoutes(consultationsRouter, { llmLimiter, requireAbuseChallenge });

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
  idempotency(),
  asyncHandler(async (req, res) => {
    const sr = await serviceRequestsService.createFromGuestSession(
      req.params.sessionId,
      req.consultationActor,
      req.validatedBody,
    );
    await recordConsentEvent({
      subjectKey: req.validatedBody.phone || req.validatedBody.email || 'guest',
      purpose: 'guest_service_request',
      ip: String(req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim() || null,
      userAgent: req.get('user-agent') || null,
    });
    res.status(201).json(serializeServiceRequest(sr));
  }),
);
