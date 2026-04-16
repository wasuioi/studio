import {
  MetricsInvariantError,
  type StrategyOutput,
  type RunResult,
  type RunMetrics,
  type AggregatedMetrics,
  type EvalRow,
} from './types';

// Minimum reasoning length (chars) to be counted as "substantive".
// Tunable: raising catches more lazy outputs, lowering reduces false positives.
export const SUBSTANTIVE_REASONING_MIN = 50;

// Validate + metric one run output against ground truth.
// Throws MetricsInvariantError on invalid shapes so run-strategy.ts can surface them cleanly.
// NOTE: does NOT populate costUsd or latencyMs — those are filled in by run-strategy.ts.
export function scoreRunResult(
  output: StrategyOutput,
  expected: EvalRow['expected'],
): Omit<RunMetrics, 'costUsd' | 'latencyMs'> {
  if (!Number.isFinite(output.score) || output.score < 0 || output.score > 100) {
    throw new MetricsInvariantError(
      `score must be a number in [0, 100], got: ${output.score}`,
    );
  }
  const trimmed = output.reasoning.trim();
  if (trimmed.length === 0) {
    throw new MetricsInvariantError('reasoning is empty');
  }

  return {
    scoreDelta: Math.abs(output.score - expected.score),
    reasoningLength: trimmed.length,
    hasSubstantiveReasoning: trimmed.length >= SUBSTANTIVE_REASONING_MIN,
  };
}

// Aggregate metrics across N successful runs (typically for repeat runs).
// Expects all results to have non-null metrics and non-null output.
// Throws on empty input (caller should not aggregate nothing).
export function aggregateMetrics(results: RunResult[]): AggregatedMetrics {
  if (results.length === 0) {
    throw new Error('aggregateMetrics called with empty results list');
  }

  const rawScores: number[] = [];
  const scoreDeltas: number[] = [];
  const reasoningLengths: number[] = [];
  const latencies: number[] = [];
  const knownCosts: number[] = [];
  let substantiveCount = 0;

  for (const r of results) {
    if (!r.output || !r.metrics) continue; // defensive — caller should filter
    rawScores.push(r.output.score);
    scoreDeltas.push(r.metrics.scoreDelta);
    reasoningLengths.push(r.metrics.reasoningLength);
    latencies.push(r.metrics.latencyMs);
    if (r.metrics.hasSubstantiveReasoning) substantiveCount++;
    if (r.metrics.costUsd != null) knownCosts.push(r.metrics.costUsd);
  }

  const n = rawScores.length;
  const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;

  const meanScore = mean(rawScores);
  const variance = rawScores.reduce((acc, s) => acc + (s - meanScore) ** 2, 0) / n;
  const scoreStdDev = Math.sqrt(variance);

  return {
    avgScoreDelta: mean(scoreDeltas),
    scoreStdDev,
    avgReasoningLength: mean(reasoningLengths),
    substantiveReasoningRate: substantiveCount / n,
    avgCostUsd: knownCosts.length > 0 ? mean(knownCosts) : null,
    avgLatencyMs: mean(latencies),
    runCount: n,
  };
}
