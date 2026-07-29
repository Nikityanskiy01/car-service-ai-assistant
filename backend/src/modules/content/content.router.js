import { Router } from 'express';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import * as adminService from '../admin/admin.service.js';
import * as siteSettingsService from '../admin/siteSettings.service.js';

export const contentRouter = Router();

contentRouter.get(
  '/site-settings',
  asyncHandler(async (_req, res) => {
    res.json(await siteSettingsService.getSiteSettings());
  }),
);

contentRouter.get(
  '/site-items',
  asyncHandler(async (req, res) => {
    const kind = req.query.kind ? String(req.query.kind) : undefined;
    const rows = await adminService.listCmsSiteItems({ kind, publishedOnly: true });
    res.json(rows);
  }),
);

