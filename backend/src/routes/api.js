import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { csrfProtection } from '../middleware/csrf.js';
import { adminRouter } from '../modules/admin/admin.router.js';
import { analyticsRouter } from '../modules/analytics/analytics.router.js';
import { authRouter } from '../modules/auth/auth.router.js';
import { bookingsRouter } from '../modules/bookings/bookings.router.js';
import { contactRouter } from '../modules/contact/contact.router.js';
import { consultationsRouter } from '../modules/consultations/consultations.router.js';
import { requestMessagesRouter } from '../modules/requestMessages/requestMessages.router.js';
import { serviceRequestsRouter } from '../modules/serviceRequests/serviceRequests.router.js';
import { usersRouter } from '../modules/users/users.router.js';

const api = Router();

api.use(csrfProtection);

api.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', db: 'connected' });
  } catch (err) {
    logger.error({ err }, 'health check: database unreachable');
    res.status(503).json({ status: 'error', db: 'disconnected' });
  }
});

api.use('/auth', authRouter);
api.use('/contact', contactRouter);
api.use('/users', usersRouter);
api.use('/consultations', consultationsRouter);
api.use('/service-requests', serviceRequestsRouter);
api.use('/service-requests/:requestId/messages', requestMessagesRouter);
api.use('/bookings', bookingsRouter);
api.use('/admin', adminRouter);
api.use('/analytics', analyticsRouter);

export default api;
