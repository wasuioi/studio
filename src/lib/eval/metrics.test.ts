import { describe, it, expect } from 'vitest';
import { compareToLabels, spearman } from './metrics';
import { MetricsInvariantError, type FindMatchesOutput, type EvalPair } from './types';

function makeOutput(matches: Array<{ targetUserId: string; finalScore: number; failReason?: string }>): FindMatchesOutput {
  return {
    matches: matches.map(m => ({
      targetUserId: m.targetUserId,
      unidirectionalScore: m.finalScore,
      reciprocityScore: m.finalScore,
      finalScore: m.finalScore,
      failReason: m.failReason,
      reason: 'test',
    })),
  };
}

function makeExpected(items: Array<{ candidateId: string; expectedFinalScore: number; shouldTriggerDealBreaker?: boolean }>): EvalPair['expected'] {
  return items.map(i => ({
    candidateId: i.candidateId,
    expectedFinalScore: i.expectedFinalScore,
    expectedReasoning: 'test',
    shouldTriggerDealBreaker: i.shouldTriggerDealBreaker,
  }));
}

describe('spearman', () => {
  it('returns 1 for identical rankings', () => {
    expect(spearman([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 5);
  });

  it('returns -1 for reversed rankings', () => {
    expect(spearman([1, 2, 3], [3, 2, 1])).toBeCloseTo(-1, 5);
  });

  it('handles ties without crashing', () => {
    const r = spearman([1, 2, 2, 3], [10, 20, 20, 30]);
    expect(r).toBeGreaterThan(0.9);
  });

  it('throws on mismatched array lengths', () => {
    expect(() => spearman([1, 2], [1, 2, 3])).toThrow();
  });
});

describe('compareToLabels', () => {
  it('returns 0 scoreDeltaAvg for perfect match', () => {
    const output = makeOutput([
      { targetUserId: 'a', finalScore: 80 },
      { targetUserId: 'b', finalScore: 50 },
    ]);
    const expected = makeExpected([
      { candidateId: 'a', expectedFinalScore: 80 },
      { candidateId: 'b', expectedFinalScore: 50 },
    ]);
    const metrics = compareToLabels(output, expected);
    expect(metrics.scoreDeltaAvg).toBe(0);
    expect(metrics.rankingCorrelation).toBeCloseTo(1, 5);
  });

  it('computes absolute score delta correctly', () => {
    const output = makeOutput([
      { targetUserId: 'a', finalScore: 90 },
      { targetUserId: 'b', finalScore: 40 },
    ]);
    const expected = makeExpected([
      { candidateId: 'a', expectedFinalScore: 80 },
      { candidateId: 'b', expectedFinalScore: 50 },
    ]);
    const metrics = compareToLabels(output, expected);
    expect(metrics.scoreDeltaAvg).toBe(10);
  });

  it('returns negative ranking correlation when order is reversed', () => {
    const output = makeOutput([
      { targetUserId: 'a', finalScore: 90 },
      { targetUserId: 'b', finalScore: 10 },
    ]);
    const expected = makeExpected([
      { candidateId: 'a', expectedFinalScore: 10 },
      { candidateId: 'b', expectedFinalScore: 90 },
    ]);
    const metrics = compareToLabels(output, expected);
    expect(metrics.rankingCorrelation).toBeCloseTo(-1, 5);
  });

  it('computes deal-breaker agreement: all agree = 1', () => {
    const output = makeOutput([
      { targetUserId: 'a', finalScore: 0, failReason: 'attachment conflict' },
      { targetUserId: 'b', finalScore: 70 },
    ]);
    const expected = makeExpected([
      { candidateId: 'a', expectedFinalScore: 0, shouldTriggerDealBreaker: true },
      { candidateId: 'b', expectedFinalScore: 70, shouldTriggerDealBreaker: false },
    ]);
    const metrics = compareToLabels(output, expected);
    expect(metrics.dealBreakerAgreement).toBe(1);
  });

  it('computes deal-breaker agreement: half agree = 0.5', () => {
    const output = makeOutput([
      { targetUserId: 'a', finalScore: 0, failReason: 'conflict' },
      { targetUserId: 'b', finalScore: 0, failReason: 'conflict' },
    ]);
    const expected = makeExpected([
      { candidateId: 'a', expectedFinalScore: 0, shouldTriggerDealBreaker: true },
      { candidateId: 'b', expectedFinalScore: 70, shouldTriggerDealBreaker: false },
    ]);
    const metrics = compareToLabels(output, expected);
    expect(metrics.dealBreakerAgreement).toBe(0.5);
  });

  it('throws MetricsInvariantError when output drops a candidate', () => {
    const output = makeOutput([
      { targetUserId: 'a', finalScore: 80 },
    ]);
    const expected = makeExpected([
      { candidateId: 'a', expectedFinalScore: 80 },
      { candidateId: 'b', expectedFinalScore: 50 },
    ]);
    expect(() => compareToLabels(output, expected)).toThrow(MetricsInvariantError);
    try {
      compareToLabels(output, expected);
    } catch (err) {
      expect(err).toBeInstanceOf(MetricsInvariantError);
      expect((err as MetricsInvariantError).missingCandidateIds).toEqual(['b']);
    }
  });

  it('throws MetricsInvariantError when expected is empty', () => {
    const output = makeOutput([{ targetUserId: 'a', finalScore: 80 }]);
    const expected = makeExpected([]);
    expect(() => compareToLabels(output, expected)).toThrow(MetricsInvariantError);
  });
});
