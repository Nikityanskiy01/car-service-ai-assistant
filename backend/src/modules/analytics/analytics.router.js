import { Router } from 'express';
import { authJwt } from '../../middleware/authJwt.js';
import { requireRole } from '../../middleware/requireRole.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import * as analyticsService from './analytics.service.js';

export const analyticsRouter = Router();
analyticsRouter.use(authJwt);

analyticsRouter.get(
  '/ai-feedback',
  requireRole('MANAGER', 'ADMINISTRATOR'),
  asyncHandler(async (req, res) => {
    const days = req.query.days != null ? Number(req.query.days) : 7;
    res.json(await analyticsService.getAiFeedbackReport({ days }));
  }),
);

analyticsRouter.get(
  '/ai-feedback.csv',
  requireRole('MANAGER', 'ADMINISTRATOR'),
  asyncHandler(async (req, res) => {
    const days = req.query.days != null ? Number(req.query.days) : 7;
    const csv = await analyticsService.getAiFeedbackCsv({ days });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="ai-feedback-report.csv"');
    res.send(csv);
  }),
);

analyticsRouter.get(
  '/manager-kpi',
  requireRole('MANAGER', 'ADMINISTRATOR'),
  asyncHandler(async (req, res) => {
    const days = req.query.days != null ? Number(req.query.days) : 7;
    res.json(await analyticsService.managerKpiDashboard(req.user, { days }));
  }),
);

analyticsRouter.use(requireRole('ADMINISTRATOR'));

analyticsRouter.get(
  '/summary',
  asyncHandler(async (_req, res) => {
    res.json(await analyticsService.summary());
  }),
);

analyticsRouter.get(
  '/kpi',
  asyncHandler(async (req, res) => {
    const days = req.query.days != null ? Number(req.query.days) : undefined;
    res.json(await analyticsService.kpiDashboard({ days }));
  }),
);

analyticsRouter.get(
  '/kpi.csv',
  asyncHandler(async (req, res) => {
    const days = req.query.days != null ? Number(req.query.days) : undefined;
    const csv = await analyticsService.kpiCsv({ days });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="analytics-kpi.csv"');
    res.send(csv);
  }),
);
