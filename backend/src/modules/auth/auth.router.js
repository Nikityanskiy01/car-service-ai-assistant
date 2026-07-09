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

  email: z.string().email(),

  password: registerPasswordSchema,

  fullName: z.string().min(1),

  phone: z.string().min(5),

});



const loginSchema = z.object({

  email: z.string().email(),

  password: z.string().min(1),

});

const demoLoginSchema = z.object({

  role: z.enum(['CLIENT', 'MANAGER', 'ADMINISTRATOR']),

});



const env = getEnv();

const authLimiter = rateLimit({

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

  authLimiter,

  validateBody(registerSchema),

  asyncHandler(async (req, res) => {

    const out = await authService.register(req.validatedBody);

    setAuthCookies(res, out);

    res.status(201).json(authJsonPayload(out));

  }),

);

authRouter.get(

  '/demo-accounts',

  asyncHandler(async (_req, res) => {

    if (!env.DEMO_MODE) throw new AppError(404, 'Not found', 'NOT_FOUND');

    res.json({

      enabled: true,

      accounts: [

        { role: 'CLIENT', label: 'Клиент' },

        { role: 'MANAGER', label: 'Менеджер' },

        { role: 'ADMINISTRATOR', label: 'Администратор' },

      ],

    });

  }),

);

authRouter.post(

  '/demo-login',

  authLimiter,

  validateBody(demoLoginSchema),

  asyncHandler(async (req, res) => {

    if (!env.DEMO_MODE) throw new AppError(404, 'Not found', 'NOT_FOUND');

    const role = req.validatedBody.role;
    const credsByRole = {
      CLIENT: { email: env.DEMO_CLIENT_EMAIL, password: env.DEMO_CLIENT_PASSWORD },
      MANAGER: { email: env.DEMO_MANAGER_EMAIL, password: env.DEMO_MANAGER_PASSWORD },
      ADMINISTRATOR: { email: env.DEMO_ADMIN_EMAIL, password: env.DEMO_ADMIN_PASSWORD },
    };

    const out = await authService.login(credsByRole[role]);

    setAuthCookies(res, out);

    res.json(authJsonPayload(out));

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

