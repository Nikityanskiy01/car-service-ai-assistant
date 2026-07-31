import { describe, expect, it } from 'vitest';
import { normalizeImageUrl, PLACEHOLDER_FALLBACK } from './imageUrl';

describe('normalizeImageUrl', () => {
  it('passes through placeholder and external urls', () => {
    expect(normalizeImageUrl('/placeholders/hero-home.jpg')).toBe('/placeholders/hero-home.jpg');
    expect(normalizeImageUrl('/placeholders/works-brakes.jpg')).toBe('/placeholders/works-brakes.jpg');
    expect(normalizeImageUrl('https://cdn.example/photo.webp')).toBe('https://cdn.example/photo.webp');
  });

  it('returns fallback for empty values', () => {
    expect(normalizeImageUrl(null)).toBe(PLACEHOLDER_FALLBACK);
    expect(normalizeImageUrl('  ')).toBe(PLACEHOLDER_FALLBACK);
  });
});
