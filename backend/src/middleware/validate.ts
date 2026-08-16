import '../lib/zodRu.js';
import { apiMessages } from '../config/apiMessages.js';
import { sendProblem } from '../lib/problem.js';

/**
 * @param schema
 */
export function validateBody(schema) {
  return (req, res, next) => {
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

/**
 * @param schema
 */
export function validateQuery(schema) {
  return (req, res, next) => {
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
