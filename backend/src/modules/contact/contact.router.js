import { Router } from 'express';
import { z } from 'zod';
import { authJwt } from '../../middleware/authJwt.js';
import { requireRole } from '../../middleware/requireRole.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { createPublicWriteLimiter } from '../../middleware/publicWriteLimiter.js';
import { validateBody } from '../../middleware/validate.js';
import * as contactService from './contact.service.js';

const submitSchema = z.object({
  fullName: z.string().trim().min(1, 'Имя обязательно').max(120),
  phone: z.string().min(1, 'Телефон обязателен').max(40),
  message: z.string().max(4000).optional().nullable(),
  source: z.string().trim().max(80).optional(),
  consentPersonalData: z.literal(true, {
    errorMap: () => ({ message: 'Необходимо согласие на обработку персональных данных' }),
  }),
});

const patchStatusSchema = z.object({
  status: z.enum(['NEW', 'IN_PROGRESS', 'CLOSED']),
  closedReason: z.string().max(500).optional(),
});

const publicWriteLimiter = createPublicWriteLimiter(20);

export const contactRouter = Router();

contactRouter.post(
  '/',
  publicWriteLimiter,
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
  asyncHandler(async (req, res) => {
    const status = req.query.status ? String(req.query.status) : undefined;
    const list = await contactService.listSubmissions({ status });
    res.json(list);
  }),
);

contactRouter.patch(
  '/:contactId',
  authJwt,
  requireRole('MANAGER', 'ADMINISTRATOR'),
  validateBody(patchStatusSchema),
  asyncHandler(async (req, res) => {
    const row = await contactService.updateSubmissionStatus(req.params.contactId, req.validatedBody);
    res.json(row);
  }),
);

contactRouter.post(
  '/:contactId/convert-to-request',
  authJwt,
  requireRole('MANAGER', 'ADMINISTRATOR'),
  asyncHandler(async (req, res) => {
    const out = await contactService.convertSubmissionToRequest(req.params.contactId, req.user.id);
    res.status(out.alreadyConverted ? 200 : 201).json(out);
  }),
);
