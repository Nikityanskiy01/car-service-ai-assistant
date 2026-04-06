import { Router } from 'express';
import { z } from 'zod';
import { authJwt } from '../../middleware/authJwt.js';
import { requireRole } from '../../middleware/requireRole.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { validateBody } from '../../middleware/validate.js';
import * as contactService from './contact.service.js';

const submitSchema = z.object({
  fullName: z.string().trim().min(1, 'Имя обязательно').max(120),
  phone: z.string().min(1, 'Телефон обязателен').max(40),
  message: z.string().max(4000).optional().nullable(),
});

export const contactRouter = Router();

contactRouter.post(
  '/',
  validateBody(submitSchema),
  asyncHandler(async (req, res) => {
    const row = await contactService.createSubmission(req.validatedBody);
    res.status(201).json({ ok: true, id: row.id });
  }),
);

contactRouter.get(
  '/',
  authJwt,
  requireRole('MANAGER', 'ADMINISTRATOR'),
  asyncHandler(async (_req, res) => {
    const list = await contactService.listSubmissions();
    res.json(list);
  }),
);
