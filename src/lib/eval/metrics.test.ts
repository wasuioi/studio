import { describe, it, expect } from 'vitest';
import { scoreRunResult, aggregateMetrics, SUBSTANTIVE_REASONING_MIN } from './metrics';
import { MetricsInvariantError, type StrategyOutput, type RunResult } from './types';

const expected = { score: 70, reasoning: 'human ground truth' };

function makeOutput(score: number, reasoning: string): StrategyOutput {
  return { score, reasoning };
}

function makeResult(id: string, score: number, reasoning: string, costUsd: number | null = 0.001, latencyMs: number = 1000): RunResult {
  return {
    id,
    strategyId: 's',
    rowId: 'r',
    runIndex: 0,
    timestamp: new Date().toISOString(),
    output: { score, reasoning },
    metrics: {
      scoreDelta: Math.abs(score - expected.score),
      reasoningLength: reasoning.trim().length,
      hasSubstantiveReasoning: reasoning.trim().length >= SUBSTANTIVE_REASONING_MIN,
      costUsd,
      latencyMs,
    },
  };
}

describe('scoreRunResult', () => {
  it('returns 0 scoreDelta when output matches expected', () => {
    const metrics = scoreRunResult(makeOutput(70, 'This is a thoughtful reasoning that is well above fifty characters long.'), expected);
    expect(metrics.scoreDelta).toBe(0);
    expect(metrics.hasSubstantiveReasoning).toBe(true);
  });

  it('computes absolute score delta', () => {
    const metrics = scoreRunResult(makeOutput(85, 'Some thoughtful reasoning that is definitely more than fifty chars.'), expected);
    expect(metrics.scoreDelta).toBe(15);
  });

  it('flags short reasoning as non-substantive', () => {
    const metrics = scoreRunResult(makeOutput(70, 'too short'), expected);
    expect(metrics.hasSubstantiveReasoning).toBe(false);
    expect(metrics.reasoningLength).toBe(9);
  });

  it('threshold boundary: exactly SUBSTANTIVE_REASONING_MIN chars is substantive', () => {
    const exactlyMin = 'x'.repeat(SUBSTANTIVE_REASONING_MIN);
    const metrics = scoreRunResult(makeOutput(70, exactlyMin), expected);
    expect(metrics.hasSubstantiveReasoning).toBe(true);
    expect(metrics.reasoningLength).toBe(SUBSTANTIVE_REASONING_MIN);
  });

  it('threshold boundary: one below min is NOT substantive', () => {
    const belowMin = 'x'.repeat(SUBSTANTIVE_REASONING_MIN - 1);
    const metrics = scoreRunResult(makeOutput(70, belowMin), expected);
    expect(metrics.hasSubstantiveReasoning).toBe(false);
  });

  it('throws MetricsInvariantError when score is below 0', () => {
    expect(() => scoreRunResult(makeOutput(-1, 'valid reasoning here that is more than fifty chars long enough'), expected))
      .toThrow(MetricsInvariantError);
  });

  it('throws MetricsInvariantError when score is above 100', () => {
    expect(() => scoreRunResult(makeOutput(101, 'valid reasoning here that is more than fifty chars long enough'), expected))
      .toThrow(MetricsInvariantError);
  });

  it('throws MetricsInvariantError on empty reasoning', () => {
    expect(() => scoreRunResult(makeOutput(70, ''), expected))
      .toThrow(MetricsInvariantError);
    expect(() => scoreRunResult(makeOutput(70, '   '), expected))
      .toThrow(MetricsInvariantError);
  });
});

describe('aggregateMetrics', () => {
  it('returns stddev 0 for a single run', () => {
    const agg = aggregateMetrics([makeResult('r1', 70, 'long enough reasoning that passes the fifty char threshold here')]);
    expect(agg.runCount).toBe(1);
    expect(agg.scoreStdDev).toBe(0);
    expect(agg.avgScoreDelta).toBe(0);
  });

  it('computes population stddev of raw scores across runs', () => {
    // Scores 90, 10, 50. Mean = 50. Variance = ((40)^2 + (-40)^2 + 0^2) / 3 = 3200/3 ≈ 1066.67
    // stddev ≈ sqrt(1066.67) ≈ 32.66
    const results = [
      makeResult('r1', 90, 'thoughtful reasoning that is above fifty characters long enough here'),
      makeResult('r2', 10, 'thoughtful reasoning that is above fifty characters long enough here'),
      makeResult('r3', 50, 'thoughtful reasoning that is above fifty characters long enough here'),
    ];
    const agg = aggregateMetrics(results);
    expect(agg.runCount).toBe(3);
    expect(agg.scoreStdDev).toBeGreaterThan(32);
    expect(agg.scoreStdDev).toBeLessThan(33);
  });

  it('computes substantive reasoning rate as a fraction', () => {
    const results = [
      makeResult('r1', 70, 'long enough reasoning that passes the fifty char threshold here'), // substantive
      makeResult('r2', 70, 'long enough reasoning that passes the fifty char threshold here'), // substantive
      makeResult('r3', 70, 'too short'),                                                        // NOT substantive
      makeResult('r4', 70, 'also too short'),                                                   // NOT substantive
    ];
    const agg = aggregateMetrics(results);
    expect(agg.substantiveReasoningRate).toBe(0.5);
  });

  it('computes avgCostUsd, skipping nulls', () => {
    const results = [
      makeResult('r1', 70, 'long enough reasoning that passes the fifty char threshold here', 0.002),
      makeResult('r2', 70, 'long enough reasoning that passes the fifty char threshold here', 0.004),
      makeResult('r3', 70, 'long enough reasoning that passes the fifty char threshold here', null), // unknown model
    ];
    const agg = aggregateMetrics(results);
    // Avg of the two known values: (0.002 + 0.004) / 2 = 0.003
    expect(agg.avgCostUsd).toBeCloseTo(0.003, 6);
  });

  it('returns null avgCostUsd when all costs are null', () => {
    const results = [
      makeResult('r1', 70, 'long enough reasoning that passes the fifty char threshold here', null),
      makeResult('r2', 70, 'long enough reasoning that passes the fifty char threshold here', null),
    ];
    const agg = aggregateMetrics(results);
    expect(agg.avgCostUsd).toBeNull();
  });

  it('throws on empty input', () => {
    expect(() => aggregateMetrics([])).toThrow();
  });
});
