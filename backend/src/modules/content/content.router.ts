import crypto from 'crypto';
import { Router } from 'express';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { createTtlCache } from '../../lib/ttlCache.js';
import * as adminService from '../admin/admin.service.js';
import * as siteSettingsService from '../admin/siteSettings.service.js';

export const contentRouter = Router();

const siteItemsCache = createTtlCache(60_000);

function sendPublicJson(req, res, payload, maxAgeSec = 60) {
  const body = JSON.stringify(payload);
  const etag = `"${crypto.createHash('sha1').update(body).digest('hex')}"`;
  res.setHeader('Cache-Control', `public, max-age=${maxAgeSec}, stale-while-revalidate=300`);
  res.setHeader('ETag', etag);
  if (req.headers['if-none-match'] === etag) {
    return res.status(304).end();
  }
  res.type('json').send(body);
}

contentRouter.get(
  '/site-settings',
  asyncHandler(async (req, res) => {
    sendPublicJson(req, res, await siteSettingsService.getSiteSettings(), 60);
  }),
);

contentRouter.get(
  '/site-items',
  asyncHandler(async (req, res) => {
    const kind = req.query.kind ? String(req.query.kind) : '';
    const cacheKey = `site-items:${kind || 'all'}`;
    let rows = siteItemsCache.get(cacheKey);
    if (!rows) {
      rows = await adminService.listCmsSiteItems({ kind: kind || undefined, publishedOnly: true });
      siteItemsCache.set(cacheKey, rows);
    }
    sendPublicJson(req, res, rows, 60);
  }),
);

/** Invalidate public CMS cache after admin mutations. */
export function invalidatePublicSiteItemsCache() {
  siteItemsCache.clear();
}
