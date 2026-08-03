import { Router } from 'express';
import { z } from 'zod';
import { authJwt } from '../../middleware/authJwt.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { validateBody } from '../../middleware/validate.js';
import { setAuthCookies } from '../../lib/authCookies.js';
import { getEnv } from '../../config/env.js';
import { registerPasswordSchema } from '../../lib/passwordPolicy.js';
import * as authService from '../auth/auth.service.js';
import * as consultationsService from '../consultations/consultations.service.js';
import * as usersService from './users.service.js';

const patchSchema = z.object({
  fullName: z.string().min(1).optional(),
  phone: z.string().min(5).optional(),
  emailProfile: z.string().email().optional().nullable(),
  city: z.string().max(120).optional().nullable(),
  telegram: z.string().max(64).optional().nullable(),
  preferredContact: z.enum(['PHONE', 'EMAIL', 'TELEGRAM']).optional().nullable(),
});

const avatarSchema = z.object({
  mimeType: z.string().min(3).max(120),
  contentBase64: z.string().min(1).max(3_000_000),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: registerPasswordSchema,
});

const env = getEnv();

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
    res.json(u);
  }),
);

usersRouter.get(
  '/me/summary',
  asyncHandler(async (req, res) => {
    const summary = await usersService.getMeSummary(req.user.id);
    res.json(summary);
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
