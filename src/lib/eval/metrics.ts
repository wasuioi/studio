import {
  MetricsInvariantError,
  type FindMatchesOutput,
  type EvalPair,
  type RunMetrics,
} from './types';

// Spearman rank correlation coefficient. O(n²) ranking with ties.
// For N < 50 this is plenty fast and simpler than O(n log n).
export function spearman(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`spearman: length mismatch (${a.length} vs ${b.length})`);
  }
  if (a.length < 2) return 0;

  const rankA = toRanks(a);
  const rankB = toRanks(b);

  const meanA = mean(rankA);
  const meanB = mean(rankB);

  let num = 0;
  let denA = 0;
  let denB = 0;
  for (let i = 0; i < rankA.length; i++) {
    const dA = rankA[i] - meanA;
    const dB = rankB[i] - meanB;
    num += dA * dB;
    denA += dA * dA;
    denB += dB * dB;
  }
  const den = Math.sqrt(denA * denB);
  if (den === 0) return 0;
  return num / den;
}

// Convert a numeric array to ranks (1-based). Tied values share an average rank.
function toRanks(values: number[]): number[] {
  const indexed = values.map((v, i) => ({ v, i }));
  indexed.sort((x, y) => x.v - y.v);
  const ranks = new Array<number>(values.length);

  let i = 0;
  while (i < indexed.length) {
    let j = i;
    while (j + 1 < indexed.length && indexed[j + 1].v === indexed[i].v) j++;
    const avgRank = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) {
      ranks[indexed[k].i] = avgRank;
    }
    i = j + 1;
  }
  return ranks;
}

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

// Compare one LLM output against a pair's expected labels.
// Throws MetricsInvariantError if the output is structurally incompatible with the labels.
// NOTE: does NOT populate costUsd or latencyMs — those are filled in by run-strategy.ts.
export function compareToLabels(
  output: FindMatchesOutput,
  expected: EvalPair['expected'],
): Omit<RunMetrics, 'costUsd' | 'latencyMs'> {
  if (expected.length === 0) {
    throw new MetricsInvariantError('expected labels list is empty');
  }

  const outputIds = new Set(output.matches.map(m => m.targetUserId));
  const missing = expected
    .map(e => e.candidateId)
    .filter(id => !outputIds.has(id));
  if (missing.length > 0) {
    throw new MetricsInvariantError(
      `LLM output is missing ${missing.length} candidate(s): ${missing.join(', ')}`,
      missing,
    );
  }

  const modelScores: number[] = [];
  const expectedScores: number[] = [];
  let dealBreakerMatches = 0;

  for (const exp of expected) {
    const match = output.matches.find(m => m.targetUserId === exp.candidateId);
    if (!match) {
      throw new MetricsInvariantError(`missing candidate ${exp.candidateId}`);
    }
    modelScores.push(match.finalScore);
    expectedScores.push(exp.expectedFinalScore);

    const modelTriggeredDB = match.finalScore === 0 || Boolean(match.failReason);
    const expectedDB = Boolean(exp.shouldTriggerDealBreaker);
    if (modelTriggeredDB === expectedDB) dealBreakerMatches++;
  }

  const deltas = modelScores.map((s, i) => Math.abs(s - expectedScores[i]));
  const scoreDeltaAvg = mean(deltas);

  return {
    scoreDeltaAvg,
    rankingCorrelation: spearman(modelScores, expectedScores),
    dealBreakerAgreement: dealBreakerMatches / expected.length,
  };
}
