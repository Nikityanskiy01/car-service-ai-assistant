import { Router } from 'express';
import { csrfProtection } from '../middleware/csrf.js';
import { adminRouter } from '../modules/admin/admin.router.js';
import { analyticsRouter } from '../modules/analytics/analytics.router.js';
import { authRouter } from '../modules/auth/auth.router.js';
import { bookingsRouter } from '../modules/bookings/bookings.router.js';
import { contactRouter } from '../modules/contact/contact.router.js';
import { consultationsRouter } from '../modules/consultations/consultations.router.js';
import { contentRouter } from '../modules/content/content.router.js';
import {
  integrationsAdminRouter,
  integrationsManagerRouter,
  integrationsPublicWebhookRouter,
} from '../modules/integrations/integrations.router.js';
import { requestMessagesRouter } from '../modules/requestMessages/requestMessages.router.js';
import { serviceRequestsRouter } from '../modules/serviceRequests/serviceRequests.router.js';
import { usersRouter } from '../modules/users/users.router.js';
import { vehiclesRouter } from '../modules/vehicles/vehicles.router.js';
import { serviceRecordsRouter } from '../modules/serviceRecords/serviceRecords.router.js';
import { productEventsRouter } from '../modules/productEvents/productEvents.router.js';
import { livePayload, readyPayload } from '../lib/health.js';
import { renderPrometheusMetrics } from '../lib/httpMetrics.js';
import { getLlmMetricsSnapshot } from '../services/llmMetrics.service.js';
import { sendProblem } from '../lib/problem.js';

const api = Router();

api.get('/live', (_req, res) => {
  res.json(livePayload());
});

api.get('/ready', async (_req, res) => {
  const payload = await readyPayload();
  res.status(payload.status === 'ready' ? 200 : 503).json(payload);
});

api.get('/health', async (_req, res) => {
  const payload = await readyPayload();
  if (payload.status !== 'ready') {
    res.status(503).json({ status: 'error', db: payload.checks.db, redis: payload.checks.redis });
    return;
  }
  res.json({ status: 'ok', db: 'connected', redis: payload.checks.redis });
});

api.get('/metrics', (_req, res) => {
  res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
  res.send(renderPrometheusMetrics(getLlmMetricsSnapshot()));
});

api.use(csrfProtection);

api.use('/product-events', productEventsRouter);
api.use('/contact', contactRouter);
api.use('/content', contentRouter);
api.use('/auth', authRouter);
api.use('/users', usersRouter);
api.use('/vehicles', vehiclesRouter);
api.use(serviceRecordsRouter);
api.use('/consultations', consultationsRouter);
api.use('/service-requests', serviceRequestsRouter);
api.use('/service-requests/:requestId/messages', requestMessagesRouter);
api.use('/bookings', bookingsRouter);
api.use('/admin', adminRouter);
api.use('/admin', integrationsAdminRouter);
api.use('/analytics', analyticsRouter);
api.use('/manager', integrationsManagerRouter);
api.use('/webhooks', integrationsPublicWebhookRouter);

api.use((req, res) => sendProblem(res, { status: 404, detail: 'Not found', code: 'NOT_FOUND' }));

export default api;
