import { Router } from 'express';
import { z } from 'zod';
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
import { createAbuseChallenge, verifyAbuseChallenge } from '../../lib/guestPow.js';
import { recordConsentEvent } from '../privacy/consent.service.js';
import { validateBody, validateQuery } from '../../middleware/validate.js';
import { isAppError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import * as consultationsService from './consultations.service.js';
import { getDiagnosisJobForSession } from '../../services/diagnosisJob.service.js';
import * as serviceRequestsService from '../serviceRequests/serviceRequests.service.js';
import * as referenceService from '../reference/reference.service.js';
import { buildConsultationPdfBuffer } from '../../lib/pdf/consultationPdf.js';

const photoSchema = z.object({
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  imageBase64: z.string().min(100).max(6_000_000),
});

const messageSchema = z.object({
  content: z.string().min(1).max(4000),
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
  consentPersonalData: z.literal(true, {
    errorMap: () => ({ message: 'Необходимо согласие на обработку персональных данных' }),
  }),
});

const staffSessionsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional().default(500),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export const consultationsRouter = Router();

const createSessionLimiter = createPublicWriteLimiter(40);
const llmLimiter = createLlmLimiter();
const visionLimiter = createVisionLimiter();

function requireAbuseChallenge(req, res, next) {
  if (process.env.NODE_ENV === 'test' || req.user) return next();
  const ok = verifyAbuseChallenge({
    nonce: req.headers['x-abuse-nonce'],
    issuedAt: req.headers['x-abuse-issued'],
    difficulty: req.headers['x-abuse-difficulty'],
    sig: req.headers['x-abuse-sig'],
    solution: req.headers['x-abuse-solution'],
  });
  if (!ok) {
    return res.status(403).json({ error: 'Требуется проверка антибота', code: 'ABUSE_CHALLENGE' });
  }
  next();
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
    const { limit, offset } = req.validatedQuery;
    const { items, total } = await consultationsService.listSessionsForStaff({ limit, offset });
    res.json({
      items: items.map(serializeStaffSessionList),
      total,
      limit,
      offset,
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

consultationsRouter.post(
  '/:sessionId/messages/stream',
  llmLimiter,
  optionalAuthJwt,
  consultationSessionAccess,
  blockStaffFromPosting,
  validateBody(messageSchema),
  asyncHandler(async (req, res) => {
    const startedAt = Date.now();
    const requestId = req.id || req.headers['x-request-id'] || null;
    const sessionId = req.params.sessionId;
    let closed = false;
    let firstProgressAt = null;

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const send = (event, data) => {
      if (closed || res.writableEnded || res.destroyed) return;
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      if (typeof res.flush === 'function') res.flush();
    };

    const heartbeat = setInterval(() => {
      send('heartbeat', { ts: Date.now() });
    }, 15_000);

    req.on('close', () => {
      if (closed) return;
      closed = true;
      clearInterval(heartbeat);
      logger.info(
        {
          requestId,
          sessionId,
          stage: 'sse_connection_closed',
          durationMs: Date.now() - startedAt,
        },
        'consultation stream closed',
      );
    });

    logger.info({ requestId, sessionId, stage: 'consultation_request_received' }, 'consultation stream received');
    send('connected', { sessionId, requestId });
    send('thinking', { phase: 'started' });

    try {
      logger.info({ requestId, sessionId, stage: 'llm_request_started' }, 'consultation processing started');
      const session = await consultationsService.postMessage(
        sessionId,
        req.consultationActor,
        req.validatedBody.content,
        (progress) => {
          if (!firstProgressAt) {
            firstProgressAt = Date.now();
            logger.info(
              {
                requestId,
                sessionId,
                stage: 'llm_first_chunk_received',
                durationMs: firstProgressAt - startedAt,
              },
              'consultation first progress received',
            );
          }
          send('progress', progress);
        },
      );
      logger.info(
        {
          requestId,
          sessionId,
          stage: 'llm_request_completed',
          durationMs: Date.now() - startedAt,
        },
        'consultation processing completed',
      );
      send('done', serializeSessionDetail(session));
      logger.info(
        {
          requestId,
          sessionId,
          stage: 'sse_result_sent',
          durationMs: Date.now() - startedAt,
        },
        'consultation stream result sent',
      );
    } catch (e) {
      logger.warn(
        {
          requestId,
          sessionId,
          stage: 'llm_request_failed',
          durationMs: Date.now() - startedAt,
          code: isAppError(e) ? e.code : null,
          message: e instanceof Error ? e.message : String(e),
        },
        'consultation stream failed',
      );
      if (isAppError(e) && (e.statusCode === 503 || e.code === 'LLM_ERROR')) {
        send('error', {
          message:
            'Сервис интеллектуального анализа временно недоступен. Вы можете сохранить обращение и передать его менеджеру.',
          code: 'LLM_ERROR',
        });
      } else {
        const safeMessage = 'Не удалось обработать сообщение. Попробуйте повторить отправку.';
        send('error', { message: safeMessage });
      }
    }

    clearInterval(heartbeat);
    res.end();
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

function serializeSession(s, { isGuest } = {}) {
  const guest = isGuest ?? s.clientId == null;
  return {
    id: s.id,
    status: s.status,
    vehicleId: s.vehicleId ?? null,
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
  const flow =
    s.flowState && typeof s.flowState === 'object' && !Array.isArray(s.flowState) ? s.flowState : {};
  return {
    ...serializeSession(s),
    make: s.extracted?.make ?? null,
    model: s.extracted?.model ?? null,
    symptoms: s.extracted?.symptoms ?? null,
    extracted: s.extracted,
    serviceRequest: s.serviceRequest,
    intent: flow.intent ?? null,
    serviceType: flow.service_type ?? null,
    serviceCategoryName: s.serviceCategory?.name ?? null,
  };
}

function serializeStaffSessionList(s) {
  return {
    id: s.id,
    status: s.status,
    progressPercent: s.progressPercent,
    createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : s.createdAt,
    updatedAt: s.updatedAt instanceof Date ? s.updatedAt.toISOString() : s.updatedAt,
    client: s.client
      ? {
          id: s.client.id,
          fullName: s.client.fullName,
          phone: s.client.phone,
          email: s.client.emailProfile || s.client.email,
        }
      : null,
    guestName: s.guestName || null,
    guestPhone: s.guestPhone || null,
    make: s.extracted?.make ?? null,
    model: s.extracted?.model ?? null,
    serviceRequest: s.serviceRequest,
    serviceCategoryName: s.serviceCategory?.name ?? null,
  };
}

function serializeSessionDetail(s) {
  const diagnosisSnapshot =
    s?.flowState && typeof s.flowState === 'object' && !Array.isArray(s.flowState)
      ? s.flowState.diagnosis || null
      : null;
  return {
    ...serializeSession(s),
    flowState: s.flowState ?? null,
    diagnosis: diagnosisSnapshot,
    client: s.client
      ? {
          id: s.client.id,
          fullName: s.client.fullName,
          phone: s.client.phone,
          email: s.client.emailProfile || s.client.email,
        }
      : undefined,
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
    diagnosisJob: s.diagnosisJob
      ? {
          id: s.diagnosisJob.id,
          status: s.diagnosisJob.status,
          errorMessage: s.diagnosisJob.errorMessage,
          updatedAt: s.diagnosisJob.updatedAt.toISOString(),
        }
      : null,
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
