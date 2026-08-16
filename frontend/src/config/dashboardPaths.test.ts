import { describe, expect, it } from 'vitest';
import {
  dashboardHomeFor,
  dashboardProfileFor,
  dashboardZoneFor,
  isDashboardPathAllowedFor,
  isTotpSetupScreen,
  resolveRedirectFor,
  totpSetupPathFor,
} from './dashboardPaths';

describe('dashboardHomeFor', () => {
  it('maps every role to its own workspace', () => {
    expect(dashboardHomeFor('CLIENT')).toBe('/dashboard/client');
    expect(dashboardHomeFor('MANAGER')).toBe('/dashboard/manager');
    expect(dashboardHomeFor('ADMINISTRATOR')).toBe('/dashboard/admin');
  });

  it('falls back to the client workspace without a role', () => {
    expect(dashboardHomeFor(null)).toBe('/dashboard/client');
    expect(dashboardHomeFor(undefined)).toBe('/dashboard/client');
  });
});

describe('dashboardProfileFor', () => {
  it('keeps the profile inside the role workspace', () => {
    expect(dashboardProfileFor('MANAGER')).toBe('/dashboard/manager/profile');
    expect(dashboardProfileFor('ADMINISTRATOR')).toBe('/dashboard/admin/profile');
  });
});

describe('dashboardZoneFor', () => {
  it('resolves the zone from a nested path', () => {
    expect(dashboardZoneFor('/dashboard/admin/ai/status')).toBe('/dashboard/admin');
    expect(dashboardZoneFor('/dashboard/manager/requests/42')).toBe('/dashboard/manager');
    expect(dashboardZoneFor('/dashboard/client/cases/7')).toBe('/dashboard/client');
  });

  it('treats unknown dashboard paths as the client zone', () => {
    expect(dashboardZoneFor('/dashboard')).toBe('/dashboard/client');
  });
});

describe('isDashboardPathAllowedFor', () => {
  it('keeps the client zone for clients only', () => {
    expect(isDashboardPathAllowedFor('/dashboard/client/cases', 'CLIENT')).toBe(true);
    expect(isDashboardPathAllowedFor('/dashboard/client/cases', 'MANAGER')).toBe(false);
    expect(isDashboardPathAllowedFor('/dashboard/client', 'ADMINISTRATOR')).toBe(false);
  });

  it('keeps each role inside its own workspace', () => {
    expect(isDashboardPathAllowedFor('/dashboard/manager/requests', 'MANAGER')).toBe(true);
    expect(isDashboardPathAllowedFor('/dashboard/manager/requests', 'ADMINISTRATOR')).toBe(false);
    expect(isDashboardPathAllowedFor('/dashboard/manager', 'CLIENT')).toBe(false);
    expect(isDashboardPathAllowedFor('/dashboard/admin', 'MANAGER')).toBe(false);
  });

  it('does not restrict public paths', () => {
    expect(isDashboardPathAllowedFor('/booking', 'MANAGER')).toBe(true);
    expect(isDashboardPathAllowedFor('/consult', null)).toBe(true);
  });
});

describe('resolveRedirectFor', () => {
  it('sends a manager to the work desk instead of a stale client link', () => {
    expect(resolveRedirectFor('/dashboard/client', 'MANAGER')).toBe('/dashboard/manager');
    expect(resolveRedirectFor('/dashboard/client/cases/7', 'ADMINISTRATOR')).toBe('/dashboard/admin');
  });

  it('keeps a next link that the role may open, query string included', () => {
    expect(resolveRedirectFor('/dashboard/manager/requests?status=NEW', 'MANAGER')).toBe(
      '/dashboard/manager/requests?status=NEW',
    );
    expect(resolveRedirectFor('/booking', 'MANAGER')).toBe('/booking');
  });

  it('rewrites a manager next-link into the admin operations zone', () => {
    expect(resolveRedirectFor('/dashboard/manager/requests?status=NEW', 'ADMINISTRATOR')).toBe(
      '/dashboard/admin/operations/requests?status=NEW',
    );
    expect(resolveRedirectFor('/dashboard/manager/ai-quality', 'ADMINISTRATOR')).toBe(
      '/dashboard/admin/ai/feedback',
    );
    expect(resolveRedirectFor('/dashboard/manager/requests/abc', 'ADMINISTRATOR')).toBe(
      '/dashboard/admin/operations/requests/abc',
    );
  });

  it('falls back to the role home without a target', () => {
    expect(resolveRedirectFor(null, 'MANAGER')).toBe('/dashboard/manager');
    expect(resolveRedirectFor('', 'CLIENT')).toBe('/dashboard/client');
  });
});

describe('totp setup screen', () => {
  it('points staff at the protection tab of their profile', () => {
    expect(totpSetupPathFor('MANAGER')).toBe('/dashboard/manager/profile?tab=security&section=protection');
    expect(totpSetupPathFor('ADMINISTRATOR')).toBe('/dashboard/admin/profile?tab=security&section=protection');
  });

  it('recognizes the security profile as the setup screen', () => {
    expect(isTotpSetupScreen('/dashboard/manager/profile', '?tab=security&section=protection')).toBe(true);
    expect(isTotpSetupScreen('/dashboard/manager/requests', '?view=kanban')).toBe(false);
    expect(isTotpSetupScreen('/dashboard/manager/profile', '?tab=contacts')).toBe(false);
  });
});
