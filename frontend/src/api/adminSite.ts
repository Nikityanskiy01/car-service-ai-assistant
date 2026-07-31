import type { ProductConfig } from '../config/productConfig';
import { cachedPublicFetch } from '../lib/publicContentCache';
import { api } from './client';

export type SiteCmsItem = {
  id: string;
  kind: 'service' | 'work' | 'gallery';
  title: string;
  description?: string;
  price?: string;
  category?: string;
  imageUrl?: string;
  problem?: string;
  result?: string;
  term?: string;
  published: boolean;
  orderIndex: number;
  createdAt?: string;
  updatedAt?: string;
};

export type SiteContentVersion = {
  id: string;
  blockId: string;
  content: string;
  note?: string | null;
  createdAt: string;
  actor?: { id: string; fullName: string; email: string } | null;
};

export type SiteContentBlock = {
  id: string;
  key: string;
  title: string;
  section: string;
  content: string;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
  versions?: SiteContentVersion[];
};

export type SiteSettings = ProductConfig & { updatedAt?: string | null };

export function getPublicSiteSettings() {
  return cachedPublicFetch('site-settings', () => api<SiteSettings>('/content/site-settings'));
}

export function getAdminSiteSettings() {
  return api<SiteSettings>('/admin/site-settings');
}

export function patchAdminSiteSettings(body: Partial<ProductConfig>) {
  return api<SiteSettings>('/admin/site-settings', { method: 'PATCH', body });
}

export function listSiteItems(kind?: SiteCmsItem['kind']) {
  const qs = kind ? `?kind=${encodeURIComponent(kind)}` : '';
  return api<SiteCmsItem[]>(`/admin/site-items${qs}`);
}

export function createSiteItem(body: Omit<SiteCmsItem, 'id' | 'orderIndex' | 'createdAt' | 'updatedAt'> & { kind: SiteCmsItem['kind'] }) {
  return api<SiteCmsItem>('/admin/site-items', { method: 'POST', body });
}

export function updateSiteItem(
  id: string,
  body: Partial<SiteCmsItem> & { kind?: SiteCmsItem['kind'] },
) {
  return api<SiteCmsItem>(`/admin/site-items/${id}`, { method: 'PATCH', body });
}

export function deleteSiteItem(id: string) {
  return api<void>(`/admin/site-items/${id}`, { method: 'DELETE' });
}

export function reorderSiteItems(kind: SiteCmsItem['kind'], ids: string[]) {
  return api<SiteCmsItem[]>('/admin/site-items/reorder', { method: 'POST', body: { kind, ids } });
}

export function listSiteContentBlocks(section?: string) {
  const qs = section ? `?section=${encodeURIComponent(section)}` : '';
  return api<SiteContentBlock[]>(`/admin/site-content${qs}`);
}

export function createSiteContentBlock(body: {
  key: string;
  title: string;
  section?: string;
  content: string;
}) {
  return api<SiteContentBlock>('/admin/site-content', { method: 'POST', body });
}

export function patchSiteContentBlock(
  id: string,
  body: { title?: string; section?: string; content?: string; isPublished?: boolean; note?: string },
) {
  return api<SiteContentBlock>(`/admin/site-content/${id}`, { method: 'PATCH', body });
}

export function rollbackSiteContentBlock(id: string, versionId: string) {
  return api<SiteContentBlock>(`/admin/site-content/${id}/rollback`, {
    method: 'POST',
    body: { versionId },
  });
}
