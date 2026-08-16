import { describe, expect, it } from 'vitest';
import { managerNavItems } from '../config/dashboardNav';
import {
  guideSectionForPath,
  guideSectionIdForNav,
  MANAGER_GUIDE_SECTIONS,
  MANAGER_ONBOARDING_STEPS,
  MANAGER_REQUEST_TAB_HINTS,
  QUEUE_STATUS_FLOW,
  QUEUE_STATUS_HINTS,
} from './managerGuide';

const NAV_WITH_GUIDE = ['desk', 'requests', 'calendar', 'clients', 'contacts', 'ai-quality'];

describe('managerGuide', () => {
  it('covers every working manager nav section', () => {
    const navIds = managerNavItems.map((item) => item.id);
    for (const id of NAV_WITH_GUIDE) {
      expect(navIds).toContain(id);
      expect(guideSectionIdForNav(id)).toBeTruthy();
    }
  });

  it('keeps a unique hash and non-empty copy on every section', () => {
    const hashes = MANAGER_GUIDE_SECTIONS.map((section) => section.hash);
    expect(new Set(hashes).size).toBe(hashes.length);
    for (const section of MANAGER_GUIDE_SECTIONS) {
      expect(section.title.length).toBeGreaterThan(3);
      expect(section.lead.length).toBeGreaterThan(12);
      expect(section.steps.length).toBeGreaterThan(1);
    }
  });

  it('resolves the current screen from a manager path', () => {
    expect(guideSectionForPath('/dashboard/manager').id).toBe('desk');
    expect(guideSectionForPath('/dashboard/manager/requests').id).toBe('queue');
    expect(guideSectionForPath('/dashboard/manager/requests/abc').id).toBe('request');
    expect(guideSectionForPath('/dashboard/manager/calendar').id).toBe('calendar');
    expect(guideSectionForPath('/dashboard/manager/clients').id).toBe('clients');
    expect(guideSectionForPath('/dashboard/manager/contacts').id).toBe('contacts');
    expect(guideSectionForPath('/dashboard/manager/ai-quality').id).toBe('ai');
    expect(guideSectionForPath('/dashboard/admin/operations/requests').id).toBe('queue');
  });

  it('has a four-step first-visit tour', () => {
    expect(MANAGER_ONBOARDING_STEPS).toHaveLength(4);
    expect(MANAGER_ONBOARDING_STEPS.map((step) => step.id)).toEqual(['desk', 'queue', 'request', 'calendar']);
  });

  it('explains every request card tab', () => {
    expect(MANAGER_REQUEST_TAB_HINTS.summary).toMatch(/сделать/i);
    expect(MANAGER_REQUEST_TAB_HINTS.consultation).toMatch(/ассистент/i);
    expect(MANAGER_REQUEST_TAB_HINTS.messages).toMatch(/клиент/i);
    expect(MANAGER_REQUEST_TAB_HINTS.history).toMatch(/учёт/i);
  });

  it('keeps queue status hints in sync with the legend', () => {
    expect(Object.keys(QUEUE_STATUS_HINTS)).toEqual(['NEW', 'IN_PROGRESS', 'SCHEDULED', 'COMPLETED', 'CANCELLED']);
    expect(QUEUE_STATUS_FLOW.map((item) => item.hint)).toEqual(Object.values(QUEUE_STATUS_HINTS));
  });
});
