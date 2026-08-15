import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { validateBody } from '../../middleware/validate.js';
import { createPublicWriteLimiter } from '../../middleware/publicWriteLimiter.js';
import { optionalAuthJwt } from '../../middleware/authJwt.js';
import { logger } from '../../lib/logger.js';

const schema = z.object({
  name: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z][a-z0-9_]*$/),
  props: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
});

export const productEventsRouter = Router();

productEventsRouter.post(
  '/',
  createPublicWriteLimiter(120),
  optionalAuthJwt,
  validateBody(schema),
  asyncHandler(async (req, res) => {
    logger.info(
      {
        event: req.validatedBody.name,
        props: req.validatedBody.props || {},
        userId: req.user?.id || null,
        role: req.user?.role || null,
      },
      'product_event',
    );
    res.status(204).end();
  }),
);
