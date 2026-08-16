import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { apiMessages } from '../config/apiMessages.js';
import { sendProblem } from '../lib/problem.js';

export function requireRole(...roles: string[]): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return sendProblem(res, { status: 401, detail: apiMessages.common.unauthorized, code: 'UNAUTHORIZED' });
    }
    if (!roles.includes(req.user.role)) {
      return sendProblem(res, { status: 403, detail: apiMessages.common.forbidden, code: 'FORBIDDEN' });
    }
    next();
  };
}
