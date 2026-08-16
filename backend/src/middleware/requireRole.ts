import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { apiMessages } from '../config/apiMessages.js';

export function requireRole(...roles: string[]): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: apiMessages.common.unauthorized, code: 'UNAUTHORIZED' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: apiMessages.common.forbidden, code: 'FORBIDDEN' });
    }
    next();
  };
}
