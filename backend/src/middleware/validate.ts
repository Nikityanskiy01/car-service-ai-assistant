import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ZodError, ZodType } from 'zod';
import '../lib/zodRu.js';
import { apiMessages } from '../config/apiMessages.js';
import { sendProblem } from '../lib/problem.js';

export type ValidatedRequest<B = unknown, Q = unknown> = Request & {
  validatedBody: B;
  validatedQuery: Q;
};

export function validatedBody<T>(req: Request): T {
  return req.validatedBody as T;
}

export function validatedQuery<T>(req: Request): T {
  return req.validatedQuery as T;
}

function problemFromZod(req: Request, res: Response, error: ZodError) {
  const first = error.issues[0];
  return sendProblem(res, {
    status: 400,
    detail: first?.message || apiMessages.common.validationFailed,
    code: 'VALIDATION_ERROR',
    instance: req.id ? `/requests/${req.id}` : req.path,
    extras: process.env.NODE_ENV === 'production' ? undefined : { details: error.flatten() },
  });
}

export function validateBody<T>(schema: ZodType<T>): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return problemFromZod(req, res, parsed.error);
    }
    req.validatedBody = parsed.data;
    next();
  };
}

export function validateQuery<T>(schema: ZodType<T>): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.query);
    if (!parsed.success) {
      return problemFromZod(req, res, parsed.error);
    }
    req.validatedQuery = parsed.data;
    next();
  };
}
