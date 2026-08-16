import type { NextFunction, Request, Response } from 'express';
import { apiMessages } from '../config/apiMessages.js';
import { isAppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { sendProblem } from '../lib/problem.js';

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  const instance = req.id ? `/requests/${req.id}` : req.path;
  if (isAppError(err)) {
    return sendProblem(res, {
      status: err.statusCode,
      detail: err.message,
      code: err.code,
      instance,
    });
  }
  logger.error({ err, path: req.path }, 'unhandled error');
  const failure = err && typeof err === 'object' ? (err as { statusCode?: number; status?: number; message?: string }) : {};
  const status = failure.statusCode || failure.status || 500;
  const safeStatus = status >= 400 && status < 600 ? status : 500;
  const message =
    process.env.NODE_ENV === 'production' && safeStatus === 500
      ? apiMessages.common.internal
      : failure.message || apiMessages.common.internal;
  return sendProblem(res, {
    status: safeStatus,
    detail: message,
    instance,
  });
}
