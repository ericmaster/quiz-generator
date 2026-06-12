// @vitest-environment node
import { expect, test, describe } from 'vitest';
import { reciprocalRankFusion } from './rrf.js';

describe('Reciprocal Rank Fusion (RRF)', () => {
  test('fuses lists and ranks shared IDs higher', () => {
    // List A has 'doc1' at rank 1, 'doc2' at rank 2
    // List B has 'doc2' at rank 1, 'doc3' at rank 2
    const listA = ['doc1', 'doc2'];
    const listB = ['doc2', 'doc3'];

    const results = reciprocalRankFusion([listA, listB], { k: 60 });

    // RRF score calculation:
    // doc2 rank in A: 2 => contribution: 1/(60+2) = 1/62 ≈ 0.016129
    // doc2 rank in B: 1 => contribution: 1/(60+1) = 1/61 ≈ 0.016393
    // doc2 total: 1/62 + 1/61 ≈ 0.032522
    //
    // doc1 rank in A: 1 => contribution: 1/61 ≈ 0.016393
    //
    // doc3 rank in B: 2 => contribution: 1/62 ≈ 0.016129

    expect(results).toHaveLength(3);
    expect(results[0].id).toBe('doc2');
    expect(results[1].id).toBe('doc1');
    expect(results[2].id).toBe('doc3');

    expect(results[0].score).toBeCloseTo(1/62 + 1/61, 6);
    expect(results[1].score).toBeCloseTo(1/61, 6);
    expect(results[2].score).toBeCloseTo(1/62, 6);
  });

  test('handles lists of objects containing id property', () => {
    const listA = [{ id: 'doc1' }, { id: 'doc2' }];
    const listB = [{ id: 'doc2' }, { id: 'doc3' }];

    const results = reciprocalRankFusion([listA, listB], { k: 60 });

    expect(results).toHaveLength(3);
    expect(results[0].id).toBe('doc2');
    expect(results[1].id).toBe('doc1');
    expect(results[2].id).toBe('doc3');
  });

  test('respects k parameter', () => {
    const listA = ['doc1'];
    const listB = ['doc2'];

    const resultsK2 = reciprocalRankFusion([listA, listB], { k: 2 });
    // doc1 (rank 1): 1/(2+1) = 1/3
    // doc2 (rank 1): 1/(2+1) = 1/3
    // Alphabetical order tie-breaker: doc1, doc2
    expect(resultsK2[0].score).toBeCloseTo(1/3, 6);
  });

  test('respects topK limit', () => {
    const listA = ['doc1', 'doc2', 'doc3'];
    const results = reciprocalRankFusion([listA], { topK: 2 });
    expect(results).toHaveLength(2);
    expect(results[0].id).toBe('doc1');
    expect(results[1].id).toBe('doc2');
  });

  test('performs deterministic tie-breaking', () => {
    // 'docB' and 'docA' both rank 1 in their respective lists
    const listA = ['docB'];
    const listB = ['docA'];

    const results = reciprocalRankFusion([listA, listB], { k: 60 });
    // Both have score 1/61. Should sort alphabetically: docA first, then docB
    expect(results).toHaveLength(2);
    expect(results[0].id).toBe('docA');
    expect(results[1].id).toBe('docB');
  });

  test('handles empty or missing lists', () => {
    const resultsEmpty = reciprocalRankFusion([], { k: 60 });
    expect(resultsEmpty).toEqual([]);

    const resultsWithEmptyInner = reciprocalRankFusion([[], []], { k: 60 });
    expect(resultsWithEmptyInner).toEqual([]);

    const resultsWithNullElements = reciprocalRankFusion([['doc1', null, undefined, '']], { k: 60 });
    expect(resultsWithNullElements).toHaveLength(1);
    expect(resultsWithNullElements[0].id).toBe('doc1');
  });

  test('does not double-count a duplicate id within the same list (best rank wins)', () => {
    // 'a' appears twice in one list; only its first (best) rank should count,
    // so it must not outrank 'b' which sits at rank 2.
    const results = reciprocalRankFusion([['a', 'b', 'a']], { k: 60 });
    expect(results).toHaveLength(2);
    expect(results[0].id).toBe('a'); // rank 1 -> 1/61
    expect(results[0].score).toBeCloseTo(1 / 61, 9);
    expect(results[1].id).toBe('b'); // rank 2 -> 1/62
    expect(results[1].score).toBeCloseTo(1 / 62, 9);
  });
});
