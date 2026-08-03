import { describe, expect, it } from 'vitest';
import { parseProfileTab } from './profileTabs';

describe('parseProfileTab', () => {
  it('defaults to contacts', () => {
    expect(parseProfileTab(null)).toBe('contacts');
  });

  it('parses known tabs', () => {
    expect(parseProfileTab('notifications')).toBe('notifications');
    expect(parseProfileTab('security')).toBe('security');
  });

  it('falls back to contacts for legacy vehicles tab', () => {
    expect(parseProfileTab('vehicles')).toBe('contacts');
  });
});
