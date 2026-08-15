import { Router } from 'express';
import { z } from 'zod';
import { apiMessages } from '../../config/apiMessages.js';
import { getEnv } from '../../config/env.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { validateBody } from '../../middleware/validate.js';
import { authAttemptKey, createRateLimiter } from '../../middleware/rateLimitConfig.js';
import { clearAuthCookies, readCookieValue, setAuthCookies } from '../../lib/authCookies.js';
import { AppError } from '../../lib/errors.js';
import { registerPasswordSchema } from '../../lib/passwordPolicy.js';
import * as authService from './auth.service.js';
import * as otpLoginService from './otpLogin.service.js';

const registerSchema = z.object({
  email: z.string().trim().email().transform((v) => v.toLowerCase()),
  password: registerPasswordSchema,
  fullName: z.string().trim().min(1).max(120),
  phone: z.string().min(5, 'Укажите корректный номер телефона'),
  consentPersonalData: z.literal(true, {
    errorMap: () => ({ message: 'Необходимо согласие на обработку персональных данных' }),
  }),
});

const loginSchema = z
  .object({
    identifier: z.string().trim().min(5).max(254).optional(),
    // Keep accepting email during the API transition for existing clients.
    email: z.string().trim().email().transform((v) => v.toLowerCase()).optional(),
    password: z.string().min(1),
  })
  .superRefine((val, ctx) => {
    if (!val.identifier && !val.email) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Укажите телефон или email',
        path: ['identifier'],
      });
    }
  });

const loginTotpSchema = z.object({
  challengeToken: z.string().min(10),
  code: z.string().trim().min(6).max(20),
});

const otpStartSchema = z
  .object({
    channel: z.enum(['email', 'sms', 'telegram']),
    email: z
      .string()
      .trim()
      .email()
      .transform((v) => v.toLowerCase())
      .optional(),
    phone: z.string().min(5).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.channel === 'email' && !val.email) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Укажите email', path: ['email'] });
    }
    if ((val.channel === 'sms' || val.channel === 'telegram') && !val.phone) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Укажите телефон', path: ['phone'] });
    }
  });

const otpVerifySchema = z.object({
  challengeToken: z.string().min(10),
  code: z.string().trim().min(4).max(12),
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

const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  keyGenerator: authAttemptKey,
  message: { error: apiMessages.common.rateLimited, code: 'RATE_LIMITED' },
});

const registerLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  keyGenerator: authAttemptKey,
  message: { error: apiMessages.common.registrationRateLimited, code: 'RATE_LIMITED' },
});

const forgotPasswordLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  keyGenerator: authAttemptKey,
  message: { error: apiMessages.common.rateLimited, code: 'RATE_LIMITED' },
});

const verificationLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  keyGenerator: authAttemptKey,
  message: { error: apiMessages.common.rateLimited, code: 'RATE_LIMITED' },
});

function authJsonPayload(out) {
  if (env.NODE_ENV === 'test') {
    return {
      user: out.user,
      accessToken: out.accessToken,
      refreshToken: out.refreshToken,
      totpSetupPending: Boolean(out.totpSetupPending),
    };
  }
  return { user: out.user, totpSetupPending: Boolean(out.totpSetupPending) };
}

export const authRouter = Router();

authRouter.post(
  '/register',
  registerLimiter,
  authLimiter,
  validateBody(registerSchema),
  asyncHandler(async (req, res) => {
    const out = await authService.register(req.validatedBody, requestAuthMeta(req));
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
    const out = await authService.login(req.validatedBody, requestAuthMeta(req));
    if (out.requires2fa) {
      res.json({
        requires2fa: true,
        challengeToken: out.challengeToken,
        code: 'TOTP_REQUIRED',
      });
      return;
    }
    setAuthCookies(res, out);
    res.json(authJsonPayload(out));
  }),
);

authRouter.get(
  '/login-options',
  asyncHandler(async (_req, res) => {
    const out = await otpLoginService.getLoginOptions();
    res.json(out);
  }),
);

authRouter.post(
  '/otp/start',
  authLimiter,
  validateBody(otpStartSchema),
  asyncHandler(async (req, res) => {
    const out = await otpLoginService.startLoginOtp(req.validatedBody);
    res.json(out);
  }),
);

authRouter.post(
  '/otp/verify',
  authLimiter,
  validateBody(otpVerifySchema),
  asyncHandler(async (req, res) => {
    const out = await otpLoginService.verifyLoginOtp(req.validatedBody, requestAuthMeta(req));
    if (out.requires2fa) {
      res.json({
        requires2fa: true,
        challengeToken: out.challengeToken,
        code: 'TOTP_REQUIRED',
      });
      return;
    }
    setAuthCookies(res, out);
    res.json(authJsonPayload(out));
  }),
);

authRouter.post(
  '/login/2fa',
  authLimiter,
  validateBody(loginTotpSchema),
  asyncHandler(async (req, res) => {
    const out = await authService.loginWithTotp(req.validatedBody, requestAuthMeta(req));
    setAuthCookies(res, out);
    res.json(authJsonPayload(out));
  }),
);

authRouter.post(
  '/refresh',
  authLimiter,
  asyncHandler(async (req, res) => {
    const rt = readCookieValue(req, 'refresh');
    if (!rt) throw new AppError(401, apiMessages.auth.refreshRequired, 'UNAUTHORIZED');
    const out = await authService.refreshAccessToken(rt, requestAuthMeta(req));
    setAuthCookies(res, out);
    res.json(authJsonPayload(out));
  }),
);

authRouter.post(
  '/logout',
  authLimiter,
  asyncHandler(async (req, res) => {
    const rt = readCookieValue(req, 'refresh');
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
