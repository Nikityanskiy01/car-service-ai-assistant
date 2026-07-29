import { describe, expect, it } from '@jest/globals';
import { cosineSimilarity, pseudoEmbedding, toFloatVector } from '../../src/lib/vectorMath.js';
import { buildCaseMemoryDocument } from '../../src/services/caseMemoryIndexer.service.js';

describe('vectorMath', () => {
  it('cosineSimilarity is 1 for identical vectors', () => {
    const v = [1, 2, 3];
    expect(cosineSimilarity(v, v)).toBeCloseTo(1, 5);
  });

  it('pseudoEmbedding is deterministic', () => {
    const a = pseudoEmbedding('стук в подвеске', 32);
    const b = pseudoEmbedding('стук в подвеске', 32);
    expect(a).toEqual(b);
    expect(cosineSimilarity(a, b)).toBeCloseTo(1, 5);
  });

  it('similar phrases score higher than unrelated', () => {
    const stuk = pseudoEmbedding('стук в подвеске справа на неровной дороге', 64);
    const stuchit = pseudoEmbedding('стучит подвеска справа на кочках', 64);
    const engine = pseudoEmbedding('двигатель троит на холостом ходу', 64);
    expect(cosineSimilarity(stuk, stuchit)).toBeGreaterThan(cosineSimilarity(stuk, engine));
  });

  it('toFloatVector filters invalid values', () => {
    expect(toFloatVector([1, '2', null, 3.5])).toEqual([1, 2, 3.5]);
  });
});

describe('buildCaseMemoryDocument', () => {
  it('builds structured document without chat noise', () => {
    const doc = buildCaseMemoryDocument(
      {
        car_make: 'BMW',
        car_model: 'X5',
        symptoms: 'биение руля при торможении',
        conditions: 'при торможении',
      },
      ['Деформация дисков'],
    );
    expect(doc).toContain('make: BMW');
    expect(doc).toContain('symptoms: биение руля');
    expect(doc).toContain('works: Деформация дисков');
  });
});
