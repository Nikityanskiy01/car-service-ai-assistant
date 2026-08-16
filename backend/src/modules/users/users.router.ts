import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authJwt } from '../../middleware/authJwt.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { validateBody } from '../../middleware/validate.js';
import { clearAuthCookies, readCookieValue, setAuthCookies } from '../../lib/authCookies.js';
import { getEnv } from '../../config/env.js';
import * as authService from '../auth/auth.service.js';
import * as consultationsService from '../consultations/consultations.service.js';
import * as securityService from './security.service.js';
import * as contactVerifyService from './contactVerify.service.js';
import * as usersService from './users.service.js';
import * as inboxService from '../notifications/inbox.service.js';
import * as privacyService from '../privacy/privacy.service.js';
import {
  patchSchema,
  avatarSchema,
  changePasswordSchema,
  totpConfirmSchema,
  totpVerifySchema,
  totpDisableSchema,
  phoneVerifyConfirmSchema,
  sessionRevokeStartSchema,
  sessionRevokeConfirmSchema,
  loginMethodsSchema,
  notificationPrefsSchema,
  markNotificationsReadSchema,
  sensitiveActionSchema,
} from './users.schemas.js';

const env = getEnv();

const totpDisableLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.NODE_ENV === 'test' ? 10_000 : 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String(req.user?.id || req.ip || 'anon'),
  message: {
    error: 'Слишком много попыток отключить защиту. Подождите 15 минут.',
    code: 'RATE_LIMITED',
  },
});

const contactVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.NODE_ENV === 'test' ? 10_000 : 8,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String(req.user?.id || req.ip || 'anon'),
  message: {
    error: 'Слишком много попыток. Подождите и попробуйте снова.',
    code: 'RATE_LIMITED',
  },
});

const sensitiveActionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.NODE_ENV === 'test' ? 10_000 : 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String(req.user?.id || req.ip || 'anon'),
  message: {
    error: 'Слишком много попыток подтверждения. Подождите 15 минут.',
    code: 'RATE_LIMITED',
  },
});

function requestAuthMeta(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '')
    .split(',')[0]
    .trim();
  return {
    ip: forwarded || req.ip || null,
    userAgent: req.get('user-agent') || null,
  };
}

function authJsonPayload(out) {
  if (env.NODE_ENV === 'test') {
    return { ok: true, user: out.user, accessToken: out.accessToken, refreshToken: out.refreshToken };
  }
  return { ok: true, user: out.user };
}

export const usersRouter = Router();

usersRouter.use(authJwt);

usersRouter.get(
  '/me',
  asyncHandler(async (req, res) => {
    const u = await usersService.getMe(req.user.id);
    res.json({ ...u, totpSetupPending: Boolean(req.user.totpSetupPending) });
  }),
);

usersRouter.get(
  '/me/summary',
  asyncHandler(async (req, res) => {
    const summary = await usersService.getMeSummary(req.user.id);
    res.json(summary);
  }),
);

usersRouter.get(
  '/me/notifications',
  asyncHandler(async (req, res) => {
    const limit = Number.parseInt(String(req.query.limit || '30'), 10);
    const out = await inboxService.listInbox(req.user.id, { limit });
    res.json(out);
  }),
);

usersRouter.get(
  '/me/notifications/unread-count',
  asyncHandler(async (req, res) => {
    const count = await inboxService.unreadCount(req.user.id);
    res.json({ unreadCount: count });
  }),
);

usersRouter.post(
  '/me/notifications/read',
  validateBody(markNotificationsReadSchema),
  asyncHandler(async (req, res) => {
    const out = await inboxService.markRead(req.user.id, req.validatedBody.ids);
    res.json(out);
  }),
);

usersRouter.get(
  '/me/notification-preferences',
  asyncHandler(async (req, res) => {
    const prefs = await inboxService.getPreferences(req.user.id);
    res.json(prefs);
  }),
);

usersRouter.patch(
  '/me/notification-preferences',
  validateBody(notificationPrefsSchema),
  asyncHandler(async (req, res) => {
    const prefs = await inboxService.patchPreferences(req.user.id, req.validatedBody);
    res.json(prefs);
  }),
);

usersRouter.patch(
  '/me',
  validateBody(patchSchema),
  asyncHandler(async (req, res) => {
    const u = await usersService.patchMe(req.user.id, req.validatedBody);
    res.json(u);
  }),
);

usersRouter.post(
  '/me/password',
  validateBody(changePasswordSchema),
  asyncHandler(async (req, res) => {
    const out = await authService.changePassword(req.user.id, req.validatedBody);
    setAuthCookies(res, out);
    res.json(authJsonPayload(out));
  }),
);

usersRouter.get(
  '/me/security',
  asyncHandler(async (req, res) => {
    const meta = requestAuthMeta(req);
    const [status, history, sessions] = await Promise.all([
      securityService.getSecurityStatus(req.user.id),
      securityService.listLoginHistory(req.user.id, 20),
      securityService.listActiveSessions(req.user.id, {
        refreshToken: readCookieValue(req, 'refresh') || null,
        sessionId: req.user.sessionId || null,
        requestIp: meta.ip,
        requestUserAgent: meta.userAgent,
      }),
    ]);
    res.json({ ...status, history, sessions });
  }),
);

usersRouter.post(
  '/me/2fa/setup',
  asyncHandler(async (req, res) => {
    const out = await securityService.beginTotpSetup(req.user.id);
    res.json(out);
  }),
);

usersRouter.post(
  '/me/2fa/setup/cancel',
  asyncHandler(async (req, res) => {
    const out = await securityService.abortTotpSetup(req.user.id);
    res.json(out);
  }),
);

usersRouter.post(
  '/me/2fa/confirm',
  validateBody(totpConfirmSchema),
  asyncHandler(async (req, res) => {
    const confirmed = await securityService.confirmTotpSetup(req.user.id, req.validatedBody.code);
    const session = await authService.issueSession(confirmed.user, requestAuthMeta(req));
    setAuthCookies(res, session);
    res.json({
      ...authJsonPayload(session),
      backupCodes: confirmed.backupCodes,
      totpSetupPending: false,
    });
  }),
);

usersRouter.post(
  '/me/2fa/backup-codes',
  validateBody(totpVerifySchema),
  asyncHandler(async (req, res) => {
    const out = await securityService.regenerateBackupCodes(req.user.id, req.validatedBody);
    res.json(out);
  }),
);

usersRouter.post(
  '/me/2fa/disable',
  totpDisableLimiter,
  validateBody(totpDisableSchema),
  asyncHandler(async (req, res) => {
    const out = await securityService.disableTotp(req.user.id, req.validatedBody, requestAuthMeta(req));
    res.json(out);
  }),
);

usersRouter.post(
  '/me/phone/verify/start',
  contactVerifyLimiter,
  asyncHandler(async (req, res) => {
    const out = await contactVerifyService.startPhoneVerification(req.user.id);
    res.json(out);
  }),
);

usersRouter.post(
  '/me/phone/verify/confirm',
  contactVerifyLimiter,
  validateBody(phoneVerifyConfirmSchema),
  asyncHandler(async (req, res) => {
    const out = await contactVerifyService.confirmPhoneVerification(req.user.id, req.validatedBody);
    res.json(out);
  }),
);

usersRouter.post(
  '/me/telegram/link/start',
  contactVerifyLimiter,
  asyncHandler(async (req, res) => {
    const out = await contactVerifyService.startTelegramLink(req.user.id);
    res.json(out);
  }),
);

usersRouter.post(
  '/me/telegram/unlink',
  sensitiveActionLimiter,
  validateBody(sensitiveActionSchema),
  asyncHandler(async (req, res) => {
    const out = await contactVerifyService.unlinkTelegram(req.user.id, req.validatedBody);
    res.json(out);
  }),
);

usersRouter.post(
  '/me/login-methods',
  sensitiveActionLimiter,
  validateBody(loginMethodsSchema),
  asyncHandler(async (req, res) => {
    const out = await contactVerifyService.updateLoginMethods(req.user.id, req.validatedBody);
    res.json(out);
  }),
);

usersRouter.get(
  '/me/login-history',
  asyncHandler(async (req, res) => {
    const history = await securityService.listLoginHistory(req.user.id, 30);
    res.json({ items: history });
  }),
);

usersRouter.get(
  '/me/sessions',
  asyncHandler(async (req, res) => {
    const meta = requestAuthMeta(req);
    const sessions = await securityService.listActiveSessions(req.user.id, {
      refreshToken: readCookieValue(req, 'refresh') || null,
      sessionId: req.user.sessionId || null,
      requestIp: meta.ip,
      requestUserAgent: meta.userAgent,
    });
    res.json({ items: sessions });
  }),
);

usersRouter.post(
  '/me/sessions/revoke/start',
  contactVerifyLimiter,
  validateBody(sessionRevokeStartSchema),
  asyncHandler(async (req, res) => {
    const out = await securityService.startSessionRevokeChallenge(req.user.id, req.validatedBody);
    res.json(out);
  }),
);

usersRouter.delete(
  '/me/sessions/:sessionId',
  sensitiveActionLimiter,
  validateBody(sessionRevokeConfirmSchema),
  asyncHandler(async (req, res) => {
    const out = await securityService.revokeSession(
      req.user.id,
      req.params.sessionId,
      readCookieValue(req, 'refresh') || null,
      { ...req.validatedBody, currentSessionId: req.user.sessionId || null },
    );
    res.json(out);
  }),
);

usersRouter.post(
  '/me/sessions/revoke-others',
  sensitiveActionLimiter,
  validateBody(sessionRevokeConfirmSchema),
  asyncHandler(async (req, res) => {
    const out = await securityService.revokeOtherSessions(
      req.user.id,
      readCookieValue(req, 'refresh') || null,
      { ...req.validatedBody, currentSessionId: req.user.sessionId || null },
    );
    res.json(out);
  }),
);

usersRouter.post(
  '/me/avatar',
  validateBody(avatarSchema),
  asyncHandler(async (req, res) => {
    const u = await usersService.uploadAvatar(req.user.id, req.validatedBody);
    res.json(u);
  }),
);

usersRouter.delete(
  '/me/avatar',
  asyncHandler(async (req, res) => {
    const u = await usersService.removeAvatar(req.user.id);
    res.json(u);
  }),
);

usersRouter.get(
  '/me/avatar',
  asyncHandler(async (req, res) => {
    const file = await usersService.getAvatar(req.user.id);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.send(file.buffer);
  }),
);

usersRouter.get(
  '/me/consultation-reports',
  asyncHandler(async (req, res) => {
    const rows = await consultationsService.listMyReports(req.user.id);
    res.json(
      rows.map((r) => ({
        id: r.id,
        consultationSessionId: r.consultationSessionId,
        createdAt: r.createdAt.toISOString(),
        label: r.label,
        snapshotJson: r.snapshotJson,
      })),
    );
  }),
);

usersRouter.get(
  '/me/privacy/export',
  asyncHandler(async (req, res) => {
    const payload = await privacyService.exportMyData(req.user.id);
    res.setHeader('Content-Disposition', 'attachment; filename="my-data.json"');
    res.json(payload);
  }),
);

usersRouter.post(
  '/me/privacy/delete',
  sensitiveActionLimiter,
  validateBody(sensitiveActionSchema),
  asyncHandler(async (req, res) => {
    const out = await privacyService.deleteMyAccount(req.user.id, req.validatedBody);
    clearAuthCookies(res);
    res.json(out);
  }),
);
