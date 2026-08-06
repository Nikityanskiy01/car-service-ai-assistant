import { Router } from 'express';
import { z } from 'zod';
import { authJwt } from '../../middleware/authJwt.js';
import { requireRole } from '../../middleware/requireRole.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { validateBody } from '../../middleware/validate.js';
import * as serviceRecordsService from './serviceRecords.service.js';

const recordBodySchema = z.object({
  title: z.string().trim().max(200).optional().nullable(),
  worksDone: z.string().trim().max(2000).optional().nullable(),
  category: z
    .enum(['oil_change', 'maintenance', 'brakes', 'filters', 'tires', 'other'])
    .optional()
    .nullable(),
  performedAt: z.string().datetime().or(z.string().min(8).max(32)).optional().nullable(),
  mileageKm: z.coerce.number().int().min(0).max(2_000_000).optional().nullable(),
  amountMinor: z.coerce.number().int().min(0).optional().nullable(),
  workOrderNumber: z.string().trim().max(64).optional().nullable(),
});

export const serviceRecordsRouter = Router();

serviceRecordsRouter.use(authJwt, requireRole('CLIENT'));

serviceRecordsRouter.get(
  '/vehicles/:vehicleId/service-records',
  asyncHandler(async (req, res) => {
    const rows = await serviceRecordsService.listServiceRecords(req.user.id, req.params.vehicleId);
    res.json(rows);
  }),
);

serviceRecordsRouter.post(
  '/vehicles/:vehicleId/service-records',
  validateBody(recordBodySchema),
  asyncHandler(async (req, res) => {
    const row = await serviceRecordsService.createServiceRecord(
      req.user.id,
      req.params.vehicleId,
      req.validatedBody,
      { createdById: req.user.id, source: 'client_manual' },
    );
    res.status(201).json(row);
  }),
);

serviceRecordsRouter.get(
  '/vehicles/:vehicleId/maintenance-plan',
  asyncHandler(async (req, res) => {
    const plan = await serviceRecordsService.getMaintenancePlan(req.user.id, req.params.vehicleId);
    res.json(plan);
  }),
);

serviceRecordsRouter.get(
  '/vehicles/:vehicleId/service-history/export.pdf',
  asyncHandler(async (req, res) => {
    const buf = await serviceRecordsService.exportHistoryPdf(req.user.id, req.params.vehicleId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="service-history-${req.params.vehicleId}.pdf"`,
    );
    res.send(buf);
  }),
);

serviceRecordsRouter.get(
  '/maintenance-alerts',
  asyncHandler(async (req, res) => {
    const rows = await serviceRecordsService.getMaintenancePlanSummaryForClient(req.user.id);
    res.json(rows);
  }),
);

serviceRecordsRouter.patch(
  '/service-records/:recordId',
  validateBody(recordBodySchema),
  asyncHandler(async (req, res) => {
    const row = await serviceRecordsService.updateServiceRecord(
      req.user.id,
      req.params.recordId,
      req.validatedBody,
    );
    res.json(row);
  }),
);

serviceRecordsRouter.delete(
  '/service-records/:recordId',
  asyncHandler(async (req, res) => {
    await serviceRecordsService.deleteServiceRecord(req.user.id, req.params.recordId);
    res.status(204).end();
  }),
);

serviceRecordsRouter.get(
  '/service-records/:recordId/export.pdf',
  asyncHandler(async (req, res) => {
    const buf = await serviceRecordsService.exportRecordPdf(req.user.id, req.params.recordId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="service-record-${req.params.recordId}.pdf"`,
    );
    res.send(buf);
  }),
);

serviceRecordsRouter.get(
  '/service-records/:recordId/export.jpg',
  asyncHandler(async (req, res) => {
    const buf = await serviceRecordsService.exportRecordJpeg(req.user.id, req.params.recordId);
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="service-record-${req.params.recordId}.jpg"`,
    );
    res.send(buf);
  }),
);
