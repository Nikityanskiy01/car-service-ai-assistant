import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { apiMessages } from '../../config/apiMessages.js';
import { getEnv } from '../../config/env.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { validateBody, validatedBody } from '../../middleware/validate.js';
import { authAttemptKey, createRateLimiter } from '../../middleware/rateLimitConfig.js';
import { clearAuthCookies, readCookieValue, setAuthCookies } from '../../lib/authCookies.js';
import { AppError } from '../../lib/errors.js';
import { registerPasswordSchema } from '../../lib/passwordPolicy.js';
import * as authService from './auth.service.js';
import * as otpLoginService from './otpLogin.service.js';
import { isTotpChallenge, type IssuedSession, type LoginCredentials, type PasswordResetInput, type RegisterInput, type SessionMeta, type StartLoginOtpInput, type TotpLoginInput, type VerifyLoginOtpInput } from './auth.types.js';

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

function requestAuthMeta(req: Request): SessionMeta {
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
  windowMs: 2 * 60 * 1000,
  max: 20,
  skipSuccessfulRequests: true,
  keyGenerator: authAttemptKey,
  prefix: 'rl:login:',
  message: { error: apiMessages.common.rateLimited, code: 'RATE_LIMITED' },
});

/** Refresh/logout must not share the login window — otherwise a lockout also kills the session. */
const sessionLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 60,
  skipSuccessfulRequests: true,
  prefix: 'rl:session:',
  message: { error: apiMessages.common.rateLimited, code: 'RATE_LIMITED' },
});

const registerLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  keyGenerator: authAttemptKey,
  prefix: 'rl:register:',
  message: { error: apiMessages.common.registrationRateLimited, code: 'RATE_LIMITED' },
});

const forgotPasswordLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  keyGenerator: authAttemptKey,
  prefix: 'rl:forgot:',
  message: { error: apiMessages.common.rateLimited, code: 'RATE_LIMITED' },
});

const verificationLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  keyGenerator: authAttemptKey,
  prefix: 'rl:verify:',
  message: { error: apiMessages.common.rateLimited, code: 'RATE_LIMITED' },
});

const twoFactorLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  keyGenerator: authAttemptKey,
  prefix: 'rl:2fa:',
  message: { error: apiMessages.common.rateLimited, code: 'RATE_LIMITED' },
});

function authJsonPayload(out: IssuedSession) {
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

/** Drop a leftover session so 2FA is not treated as an authenticated CSRF request. */
async function respondRequires2fa(req: Request, res: Response, challengeToken: string) {
  const rt = readCookieValue(req, 'refresh');
  if (rt) await authService.logout(rt);
  clearAuthCookies(res);
  res.json({
    requires2fa: true,
    challengeToken,
    code: 'TOTP_REQUIRED',
  });
}

export const authRouter = Router();

authRouter.post(
  '/register',
  registerLimiter,
  authLimiter,
  validateBody(registerSchema),
  asyncHandler(async (req, res) => {
    const out = await authService.register(validatedBody<RegisterInput>(req), requestAuthMeta(req));
    res.status(201).json(out);
  }),
);

authRouter.post(
  '/verify-email',
  verificationLimiter,
  validateBody(verifyEmailSchema),
  asyncHandler(async (req, res) => {
    const out = await authService.verifyEmail(validatedBody<{ email: string; code: string }>(req));
    setAuthCookies(res, out);
    res.json(authJsonPayload(out));
  }),
);

authRouter.post(
  '/resend-verification',
  verificationLimiter,
  validateBody(resendVerificationSchema),
  asyncHandler(async (req, res) => {
    const out = await authService.resendVerificationEmail(validatedBody<{ email: string }>(req).email);
    res.json(out);
  }),
);

authRouter.post(
  '/login',
  authLimiter,
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const out = await authService.login(validatedBody<LoginCredentials>(req), requestAuthMeta(req));
    if (isTotpChallenge(out)) {
      await respondRequires2fa(req, res, out.challengeToken);
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
    const out = await otpLoginService.startLoginOtp(validatedBody<StartLoginOtpInput>(req));
    res.json(out);
  }),
);

authRouter.post(
  '/otp/verify',
  authLimiter,
  validateBody(otpVerifySchema),
  asyncHandler(async (req, res) => {
    const out = await otpLoginService.verifyLoginOtp(
      validatedBody<VerifyLoginOtpInput>(req),
      requestAuthMeta(req),
    );
    if (isTotpChallenge(out)) {
      await respondRequires2fa(req, res, out.challengeToken);
      return;
    }
    setAuthCookies(res, out);
    res.json(authJsonPayload(out));
  }),
);

authRouter.post(
  '/login/2fa',
  twoFactorLimiter,
  validateBody(loginTotpSchema),
  asyncHandler(async (req, res) => {
    const out = await authService.loginWithTotp(validatedBody<TotpLoginInput>(req), requestAuthMeta(req));
    setAuthCookies(res, out);
    res.json(authJsonPayload(out));
  }),
);

authRouter.post(
  '/refresh',
  sessionLimiter,
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
  sessionLimiter,
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
    const out = await authService.requestPasswordReset(validatedBody<{ email: string }>(req).email);
    res.json(out);
  }),
);

authRouter.post(
  '/reset-password',
  authLimiter,
  validateBody(resetPasswordSchema),
  asyncHandler(async (req, res) => {
    const out = await authService.resetPassword(validatedBody<PasswordResetInput>(req));
    res.json(out);
  }),
);
