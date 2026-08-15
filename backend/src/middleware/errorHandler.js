import { isAppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { sendProblem } from '../lib/problem.js';

export function errorHandler(err, req, res, _next) {
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
  const status = err.statusCode || err.status || 500;
  const safeStatus = status >= 400 && status < 600 ? status : 500;
  const message =
    process.env.NODE_ENV === 'production' && safeStatus === 500
      ? 'Internal server error'
      : err.message || 'Internal server error';
  return sendProblem(res, {
    status: safeStatus,
    detail: message,
    instance,
  });
}
