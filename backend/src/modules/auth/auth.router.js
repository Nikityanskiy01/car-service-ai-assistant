import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { getEnv } from '../../config/env.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { validateBody } from '../../middleware/validate.js';
import { clearAuthCookies, COOKIE_REFRESH, setAuthCookies } from '../../lib/authCookies.js';
import { AppError } from '../../lib/errors.js';
import { registerPasswordSchema } from '../../lib/passwordPolicy.js';
import * as authService from './auth.service.js';

const registerSchema = z.object({
  email: z.string().trim().email().transform((v) => v.toLowerCase()),
  password: registerPasswordSchema,
  fullName: z.string().trim().min(1).max(120),
  phone: z.string().min(5),
  consentPersonalData: z.literal(true, {
    errorMap: () => ({ message: 'Необходимо согласие на обработку персональных данных' }),
  }),
});

const loginSchema = z.object({
  email: z.string().trim().email().transform((v) => v.toLowerCase()),
  password: z.string().min(1),
});

const forgotPasswordSchema = z.object({
  email: z.string().trim().email().transform((v) => v.toLowerCase()),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: registerPasswordSchema,
});

const verifyEmailSchema = z.object({
  email: z.string().trim().email().transform((v) => v.toLowerCase()),
  code: z.string().trim().regex(/^\d{6}$/, 'Код должен содержать 6 цифр'),
});

const resendVerificationSchema = z.object({
  email: z.string().trim().email().transform((v) => v.toLowerCase()),
});

const env = getEnv();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.NODE_ENV === 'test' ? 10_000 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts, please try again later' },
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: env.NODE_ENV === 'test' ? 10_000 : 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many registration attempts, please try again later' },
});

const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.NODE_ENV === 'test' ? 10_000 : 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts, please try again later' },
});

const verificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.NODE_ENV === 'test' ? 10_000 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts, please try again later' },
});

function authJsonPayload(out) {
  if (env.NODE_ENV === 'test') {
    return { user: out.user, accessToken: out.accessToken, refreshToken: out.refreshToken };
  }
  return { user: out.user };
}

export const authRouter = Router();

authRouter.post(
  '/register',
  registerLimiter,
  authLimiter,
  validateBody(registerSchema),
  asyncHandler(async (req, res) => {
    const out = await authService.register(req.validatedBody);
    res.status(201).json(out);
  }),
);

authRouter.post(
  '/verify-email',
  verificationLimiter,
  validateBody(verifyEmailSchema),
  asyncHandler(async (req, res) => {
    const out = await authService.verifyEmail(req.validatedBody);
    setAuthCookies(res, out);
    res.json(authJsonPayload(out));
  }),
);

authRouter.post(
  '/resend-verification',
  verificationLimiter,
  validateBody(resendVerificationSchema),
  asyncHandler(async (req, res) => {
    const out = await authService.resendVerificationEmail(req.validatedBody.email);
    res.json(out);
  }),
);

authRouter.post(
  '/login',
  authLimiter,
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const out = await authService.login(req.validatedBody);
    setAuthCookies(res, out);
    res.json(authJsonPayload(out));
  }),
);

authRouter.post(
  '/refresh',
  authLimiter,
  asyncHandler(async (req, res) => {
    const rt = req.cookies?.[COOKIE_REFRESH];
    if (!rt) throw new AppError(401, 'Refresh token required', 'UNAUTHORIZED');
    const out = await authService.refreshAccessToken(rt);
    setAuthCookies(res, out);
    res.json(authJsonPayload(out));
  }),
);

authRouter.post(
  '/logout',
  authLimiter,
  asyncHandler(async (req, res) => {
    const rt = req.cookies?.[COOKIE_REFRESH];
    if (rt) await authService.logout(rt);
    clearAuthCookies(res);
    res.json({ ok: true });
  }),
);

authRouter.post(
  '/forgot-password',
  forgotPasswordLimiter,
  validateBody(forgotPasswordSchema),
  asyncHandler(async (req, res) => {
    const out = await authService.requestPasswordReset(req.validatedBody.email);
    res.json(out);
  }),
);

authRouter.post(
  '/reset-password',
  authLimiter,
  validateBody(resetPasswordSchema),
  asyncHandler(async (req, res) => {
    const out = await authService.resetPassword(req.validatedBody);
    res.json(out);
  }),
);
