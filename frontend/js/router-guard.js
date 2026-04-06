import { getUser } from './api.js';

/**
 * @param {('CLIENT'|'MANAGER'|'ADMINISTRATOR')[]} allowed
 */
export function requireAuth(allowed) {
  const u = getUser();
  if (!u) {
    window.location.href = '/login.html?next=' + encodeURIComponent(window.location.pathname);
    return null;
  }
  if (allowed && !allowed.includes(u.role)) {
    if (u.role === 'CLIENT') window.location.href = '/dashboards/client.html';
    else if (u.role === 'MANAGER') window.location.href = '/dashboards/manager.html';
    else window.location.href = '/dashboards/admin.html';
    return null;
  }
  return u;
}
