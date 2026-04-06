/**
 * @param {import('zod').ZodSchema} schema
 */
export function validateBody(schema) {
  return (req, res, next) => {
    const r = schema.safeParse(req.body);
    if (!r.success) {
      const first = r.error.issues[0];
      const payload = {
        error: first?.message || 'Validation failed',
        code: 'VALIDATION_ERROR',
      };
      if (process.env.NODE_ENV !== 'production') payload.details = r.error.flatten();
      return res.status(400).json(payload);
    }
    req.validatedBody = r.data;
    next();
  };
}

/**
 * @param {import('zod').ZodSchema} schema
 */
export function validateQuery(schema) {
  return (req, res, next) => {
    const r = schema.safeParse(req.query);
    if (!r.success) {
      const first = r.error.issues[0];
      const payload = {
        error: first?.message || 'Validation failed',
        code: 'VALIDATION_ERROR',
      };
      if (process.env.NODE_ENV !== 'production') payload.details = r.error.flatten();
      return res.status(400).json(payload);
    }
    req.validatedQuery = r.data;
    next();
  };
}
