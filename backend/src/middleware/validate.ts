import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ZodTypeAny } from 'zod';
import '../lib/zodRu.js';
import { apiMessages } from '../config/apiMessages.js';
import { sendProblem } from '../lib/problem.js';

export function validateBody(schema: ZodTypeAny): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const r = schema.safeParse(req.body);
    if (!r.success) {
      const first = r.error.issues[0];
      return sendProblem(res, {
        status: 400,
        detail: first?.message || apiMessages.common.validationFailed,
        code: 'VALIDATION_ERROR',
        instance: req.id ? `/requests/${req.id}` : req.path,
        extras: process.env.NODE_ENV === 'production' ? undefined : { details: r.error.flatten() },
      });
    }
    req.validatedBody = r.data;
    next();
  };
}

export function validateQuery(schema: ZodTypeAny): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const r = schema.safeParse(req.query);
    if (!r.success) {
      const first = r.error.issues[0];
      return sendProblem(res, {
        status: 400,
        detail: first?.message || apiMessages.common.validationFailed,
        code: 'VALIDATION_ERROR',
        instance: req.id ? `/requests/${req.id}` : req.path,
        extras: process.env.NODE_ENV === 'production' ? undefined : { details: r.error.flatten() },
      });
    }
    req.validatedQuery = r.data;
    next();
  };
}
