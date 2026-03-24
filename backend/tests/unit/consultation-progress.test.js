import {
  isExtractedComplete,
  mergeExtracted,
  progressFromExtracted,
} from '../../src/lib/consultationProgress.js';

describe('consultationProgress', () => {
  it('isExtractedComplete requires all six', () => {
    expect(isExtractedComplete(null)).toBe(false);
    expect(
      isExtractedComplete({
        make: 'Toyota',
        model: 'Camry',
        year: 2018,
        mileage: 100000,
        symptoms: 'стук',
        problemConditions: 'холодный',
      }),
    ).toBe(true);
    expect(
      isExtractedComplete({
        make: 'Toyota',
        model: '',
        year: 2018,
        mileage: 1,
        symptoms: 'x',
        problemConditions: 'y',
      }),
    ).toBe(false);
  });

  it('progressFromExtracted scales 0–100', () => {
    expect(progressFromExtracted({})).toBe(0);
    expect(progressFromExtracted({ make: 'a', model: 'b', year: 1, mileage: 2, symptoms: 's', problemConditions: 'p' })).toBe(100);
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
