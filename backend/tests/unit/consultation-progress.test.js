import {
  isExtractedComplete,
  mergeExtracted,
  progressFromExtracted,
} from '../../src/lib/consultationProgress.js';

describe('consultationProgress', () => {
  it('isExtractedComplete requires symptoms + (mileage or make)', () => {
    expect(isExtractedComplete(null)).toBe(false);
    expect(isExtractedComplete({})).toBe(false);
    expect(
      isExtractedComplete({ mileage: 100000, symptoms: 'стук' }),
    ).toBe(true);
    expect(
      isExtractedComplete({ make: 'Toyota', symptoms: 'замена колодок' }),
    ).toBe(true);
    expect(
      isExtractedComplete({ symptoms: 'стук' }),
    ).toBe(false);
    expect(
      isExtractedComplete({ make: 'Toyota', mileage: 41000 }),
    ).toBe(false);
  });

  it('progressFromExtracted scales 0–100', () => {
    expect(progressFromExtracted({})).toBe(0);
    expect(progressFromExtracted({ mileage: 2, symptoms: 's', problemConditions: 'p', make: 'a', model: 'b', year: 1 })).toBe(100);
  });

  it('mergeExtracted merges partial', () => {
    const m = mergeExtracted(
      { make: null, model: null, year: null, mileage: null, symptoms: null, problemConditions: null },
      { make: 'VW', year: 2010 },
    );
    expect(m.make).toBe('VW');
    expect(m.year).toBe(2010);
  });
});
