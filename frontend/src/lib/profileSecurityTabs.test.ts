import { describe, expect, it } from 'vitest';
import { parseSecuritySection } from './profileSecurityTabs';

describe('parseSecuritySection', () => {
  it('defaults to password', () => {
    expect(parseSecuritySection(null)).toBe('password');
    expect(parseSecuritySection('unknown')).toBe('password');
  });

  it('parses known sections', () => {
    expect(parseSecuritySection('access')).toBe('access');
    expect(parseSecuritySection('protection')).toBe('protection');
    expect(parseSecuritySection('sessions')).toBe('sessions');
    expect(parseSecuritySection('history')).toBe('history');
    expect(parseSecuritySection('privacy')).toBe('privacy');
  });
});
