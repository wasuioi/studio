# Find-Matches Eval Framework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an internal `/eval` page that runs configurable LLM strategies against human-labeled test pairs and compares quality, cost, and latency side-by-side, so we can pick the best and most cost-effective approach for the `findMatches` flow.

**Architecture:** Single-page dashboard at `/eval` (Next.js App Router). Browser uses `localStorage` via an `EvalStore` interface (swappable for Supabase later). LLM calls go through a `'use server'` action that hits OpenRouter — API key never reaches the browser. Existing `src/ai/flows/find-matches-flow.ts` is untouched. Full spec: `docs/superpowers/specs/2026-04-10-find-matches-eval-framework-design.md`.

**Tech Stack:** Next.js 15 App Router, TypeScript, Zod, shadcn/ui (Tabs/Dialog/Table), Vitest + happy-dom, OpenRouter REST API.

---

## Task 1: Set up Vitest test infrastructure

**Files:**
- Modify: `package.json` (scripts + devDependencies)
- Create: `vitest.config.ts`
- Create: `src/lib/eval/smoke.test.ts` (throwaway smoke test)

- [ ] **Step 1: Install test dependencies**

Run:
```bash
npm install --save-dev vitest @vitest/ui happy-dom
```

Expected: packages added to `package.json`, no errors.

- [ ] **Step 2: Add test scripts to package.json**

Edit `package.json`. In the `"scripts"` block, add:

```json
    "test": "vitest run",
    "test:watch": "vitest",
    "test:ui": "vitest --ui"
```

Place these after `"typecheck"`.

- [ ] **Step 3: Create `vitest.config.ts` at project root**

```ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    globals: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

Why `happy-dom`: gives us `window` and `localStorage` inside tests so the storage layer tests run without extra mocking.

Why `globals: false`: forces explicit imports (`import { describe, it, expect } from 'vitest'`) — makes tests easier to read.

- [ ] **Step 4: Write a smoke test to prove the runner works**

Create `src/lib/eval/smoke.test.ts`:

```ts
import { describe, it, expect } from 'vitest';

describe('vitest infrastructure', () => {
  it('runs a test', () => {
    expect(1 + 1).toBe(2);
  });

  it('has localStorage available (happy-dom)', () => {
    localStorage.setItem('smoke', 'ok');
    expect(localStorage.getItem('smoke')).toBe('ok');
    localStorage.removeItem('smoke');
  });
});
```

- [ ] **Step 5: Run tests**

Run: `npm test`
Expected: 2 passing tests, 0 failures.

- [ ] **Step 6: Delete the smoke test (we don't need it long-term)**

Run: `rm src/lib/eval/smoke.test.ts`

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "$(cat <<'EOF'
chore: add vitest + happy-dom for eval framework tests

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Shared types and model prices

**Files:**
- Create: `src/lib/eval/types.ts`
- Create: `src/lib/eval/model-prices.ts`

No tests — these files contain only type definitions and a data table.

- [ ] **Step 1: Create `src/lib/eval/types.ts`**

```ts
// Shared types for the eval framework.
// These types are the "contract" between the UI, store, and server action.

// One profile used inside an eval pair.
// Mirrors the shape expected by src/ai/flows/find-matches-flow.ts (ProfileSchema).
export interface EvalProfile {
  id: string;
  name: string;
  persona: { summary: string; tags: string[] };
  ideal_partner: { summary: string; tags: string[] };
  psychological_insights?: {
    attachmentStyle?: string;
    coreValueVsSurfaceDesire?: { surface?: string; core?: string };
    shadowSelf?: { silentDealBreakers?: string[]; recurringNeeds?: string };
    behavioralInsights?: string;
  };
  // The prompt also reads `summary` at the top level — keep it separate from persona.summary.
  summary: string;
}

// A labeled test case: one "current user" + N candidates + expected per-candidate outcomes.
export interface EvalPair {
  id: string;
  label: string;                     // human-readable, e.g. "Anxious + Avoidant deal-breaker"
  currentUser: EvalProfile;
  candidates: EvalProfile[];
  expected: Array<{
    candidateId: string;
    expectedFinalScore: number;      // 0-100, what you think the final score should be
    expectedReasoning: string;       // why
    shouldTriggerDealBreaker?: boolean;
  }>;
}

// The LLM's output for a single candidate. Mirrors MatchResultSchema from find-matches-flow.ts.
export interface MatchResult {
  targetUserId: string;
  unidirectionalScore: number;
  reciprocityScore: number;
  finalScore: number;
  failReason?: string;
  reason: string;
}

// The full output shape. Mirrors FindMatchesOutputSchema from find-matches-flow.ts.
export interface FindMatchesOutput {
  matches: MatchResult[];
}

export type PromptVariant = 'default' | 'simplified';

export interface Strategy {
  id: string;                         // unique, e.g. "gemini-flash-default"
  name: string;                       // display name
  model: string;                      // OpenRouter model ID, e.g. "google/gemini-2.5-flash"
  promptVariant: PromptVariant;
  runCount: number;                   // MVP: always 1. Future: N for median-of-N
}

export interface RunMetrics {
  scoreDeltaAvg: number;              // average |modelFinalScore - expectedFinalScore|
  rankingCorrelation: number;         // Spearman rank correlation, -1..1
  dealBreakerAgreement: number;       // 0..1, fraction of dealbreaker flags that agree
  costUsd: number | null;             // null if model not in price table
  latencyMs: number;
}

export interface RunResult {
  id: string;                         // unique per run
  strategyId: string;
  pairId: string;
  timestamp: string;                  // ISO
  output: FindMatchesOutput | null;   // null if error
  rawOutput?: string;                 // raw LLM string — useful when JSON parsing fails
  metrics: RunMetrics | null;         // null if error
  error?: string;
}

// Typed error thrown by metrics.ts invariants — run-strategy.ts catches these.
export class MetricsInvariantError extends Error {
  constructor(message: string, public readonly missingCandidateIds?: string[]) {
    super(message);
    this.name = 'MetricsInvariantError';
  }
}

// Typed error thrown by openrouter-client.ts when config is missing.
export class EvalConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EvalConfigError';
  }
}

// Typed error thrown by LocalStorageEvalStore when localStorage is full.
export class EvalStorageFullError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EvalStorageFullError';
  }
}
```

- [ ] **Step 2: Create `src/lib/eval/model-prices.ts`**

```ts
// USD per 1M tokens. Extend as you add more models.
// Sources: OpenRouter pricing page as of 2026-04-10. Values are approximate —
// cost displays in the UI are "directional", not invoices.

export interface ModelPrice {
  inputPerM: number;
  outputPerM: number;
}

export const modelPrices: Record<string, ModelPrice> = {
  'google/gemini-2.5-flash': { inputPerM: 0.075, outputPerM: 0.30 },
  'anthropic/claude-3.5-sonnet': { inputPerM: 3.0, outputPerM: 15.0 },
  'openai/gpt-4o-mini': { inputPerM: 0.15, outputPerM: 0.60 },
  'meta-llama/llama-3-8b-instruct': { inputPerM: 0.05, outputPerM: 0.08 },
};

// Compute cost in USD from token counts. Returns null if the model isn't in the table.
export function calculateCost(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number | null {
  const price = modelPrices[model];
  if (!price) return null;
  return (promptTokens * price.inputPerM + completionTokens * price.outputPerM) / 1_000_000;
}
```

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/eval/types.ts src/lib/eval/model-prices.ts
git commit -m "$(cat <<'EOF'
feat(eval): add shared types and model price table

Introduces EvalPair, Strategy, RunResult types and the OpenRouter
model price table used for cost calculation.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Metrics module (TDD)

**Files:**
- Create: `src/lib/eval/metrics.test.ts` (write FIRST)
- Create: `src/lib/eval/metrics.ts` (write AFTER the test fails)

This module is pure logic with no I/O — ideal for TDD. Tests come first.

- [ ] **Step 1: Write the failing test file**

Create `src/lib/eval/metrics.test.ts`:

```ts
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
    expect(r).toBeGreaterThan(0.9); // strong positive, not strictly 1 because of ties
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
      { candidateId: 'a', expectedFinalScore: 80 }, // delta = 10
      { candidateId: 'b', expectedFinalScore: 50 }, // delta = 10
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
      // candidate "b" missing
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
```

- [ ] **Step 2: Run tests — verify they all fail**

Run: `npm test -- metrics`
Expected: All tests fail with "Cannot find module './metrics'" or similar.

- [ ] **Step 3: Implement `src/lib/eval/metrics.ts`**

```ts
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
    // find the end of a run of equal values
    while (j + 1 < indexed.length && indexed[j + 1].v === indexed[i].v) j++;
    // average rank for the tied group (1-based)
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

  // Invariant: output must cover every expected candidate.
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

  // Align the two arrays by candidate ID (expected drives the order).
  const modelScores: number[] = [];
  const expectedScores: number[] = [];
  let dealBreakerMatches = 0;

  for (const exp of expected) {
    const match = output.matches.find(m => m.targetUserId === exp.candidateId);
    if (!match) {
      // Already caught above, but keeps TypeScript happy.
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
```

- [ ] **Step 4: Run tests — verify all pass**

Run: `npm test -- metrics`
Expected: All 11 tests pass (4 spearman + 7 compareToLabels).

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/eval/metrics.ts src/lib/eval/metrics.test.ts
git commit -m "$(cat <<'EOF'
feat(eval): add metrics module with spearman + compareToLabels

Pure-logic module that compares LLM output to labeled expected scores.
Throws MetricsInvariantError if the LLM drops a candidate (a normal
failure mode for weaker models) so run-strategy.ts can surface it
cleanly in the UI. TDD: tests written before implementation.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Seed data

**Files:**
- Create: `src/lib/eval/seed-data.ts`

Seed data must exist before the store can import it. No tests — this file is pure data.

- [ ] **Step 1: Create `src/lib/eval/seed-data.ts`**

```ts
import type { EvalPair, Strategy } from './types';

// 4 hardcoded pairs with fake expected scores. Edit these from the /eval UI to relabel.
// Each pair exercises a different scoring mechanic:
//   p1: high match (both secure, aligned core values)
//   p2: deal-breaker (anxious + avoidant → score 0)
//   p3: medium match (partial tag overlap)
//   p4: asymmetric (user loves match, match wouldn't love user back)
export const seedPairs: EvalPair[] = [
  {
    id: 'p1-secure-secure-aligned',
    label: 'High match: secure + secure, aligned core values',
    currentUser: {
      id: 'p1-user',
      name: 'Alex',
      persona: { summary: 'Thoughtful creative who values long conversations.', tags: ['creative', 'introspective', 'loyal'] },
      ideal_partner: { summary: 'Someone emotionally available and curious.', tags: ['curious', 'kind', 'secure'] },
      psychological_insights: {
        attachmentStyle: 'secure',
        coreValueVsSurfaceDesire: { surface: 'fun dates', core: 'being deeply understood' },
        shadowSelf: { silentDealBreakers: ['dishonesty'], recurringNeeds: 'emotional attunement' },
        behavioralInsights: 'Writes long thoughtful messages.',
      },
      summary: 'Alex, 28, writer and climber.',
    },
    candidates: [
      {
        id: 'p1-c1',
        name: 'Sam',
        persona: { summary: 'Warm, grounded, emotionally present.', tags: ['curious', 'kind', 'secure'] },
        ideal_partner: { summary: 'A creative who loves deep conversation.', tags: ['creative', 'introspective', 'loyal'] },
        psychological_insights: { attachmentStyle: 'secure' },
        summary: 'Sam, 29, therapist.',
      },
    ],
    expected: [
      {
        candidateId: 'p1-c1',
        expectedFinalScore: 90,
        expectedReasoning: 'Secure+secure with full mutual tag fit and core need alignment.',
        shouldTriggerDealBreaker: false,
      },
    ],
  },

  {
    id: 'p2-anxious-avoidant-dealbreaker',
    label: 'Deal-breaker: anxious + avoidant (score 0)',
    currentUser: {
      id: 'p2-user',
      name: 'Jordan',
      persona: { summary: 'Needs reassurance and closeness.', tags: ['loyal', 'affectionate'] },
      ideal_partner: { summary: 'Someone who shows up consistently.', tags: ['consistent', 'warm'] },
      psychological_insights: {
        attachmentStyle: 'anxious',
        coreValueVsSurfaceDesire: { core: 'reliable closeness' },
        shadowSelf: { silentDealBreakers: ['emotional unavailability'] },
      },
      summary: 'Jordan, 26.',
    },
    candidates: [
      {
        id: 'p2-c1',
        name: 'Riley',
        persona: { summary: 'Values independence above all; slow to open up.', tags: ['independent', 'reserved'] },
        ideal_partner: { summary: 'Someone who respects space.', tags: ['independent'] },
        psychological_insights: { attachmentStyle: 'avoidant' },
        summary: 'Riley, 30.',
      },
    ],
    expected: [
      {
        candidateId: 'p2-c1',
        expectedFinalScore: 0,
        expectedReasoning: 'Anxious + avoidant = hard deal-breaker per rubric.',
        shouldTriggerDealBreaker: true,
      },
    ],
  },

  {
    id: 'p3-medium-partial-overlap',
    label: 'Medium match: partial tag overlap',
    currentUser: {
      id: 'p3-user',
      name: 'Taylor',
      persona: { summary: 'Outdoorsy, spontaneous.', tags: ['adventurous', 'optimistic', 'artistic'] },
      ideal_partner: { summary: 'Someone adventurous and grounded.', tags: ['adventurous', 'grounded'] },
      psychological_insights: { attachmentStyle: 'secure' },
      summary: 'Taylor, 31.',
    },
    candidates: [
      {
        id: 'p3-c1',
        name: 'Morgan',
        persona: { summary: 'Adventurous but also needs quiet time.', tags: ['adventurous', 'quiet'] },
        ideal_partner: { summary: 'Spontaneous type who also likes art.', tags: ['spontaneous', 'artistic'] },
        psychological_insights: { attachmentStyle: 'secure' },
        summary: 'Morgan, 29.',
      },
      {
        id: 'p3-c2',
        name: 'Casey',
        persona: { summary: 'Homebody, analytical.', tags: ['analytical', 'calm'] },
        ideal_partner: { summary: 'Someone who pulls them out of their shell.', tags: ['extroverted'] },
        psychological_insights: { attachmentStyle: 'secure' },
        summary: 'Casey, 32.',
      },
    ],
    expected: [
      {
        candidateId: 'p3-c1',
        expectedFinalScore: 65,
        expectedReasoning: 'One shared core tag (adventurous) + partial reciprocity (artistic matches).',
        shouldTriggerDealBreaker: false,
      },
      {
        candidateId: 'p3-c2',
        expectedFinalScore: 30,
        expectedReasoning: 'Little tag overlap, lifestyles mismatch.',
        shouldTriggerDealBreaker: false,
      },
    ],
  },

  {
    id: 'p4-asymmetric',
    label: 'Asymmetric: user loves match, match would not love user back',
    currentUser: {
      id: 'p4-user',
      name: 'Avery',
      persona: { summary: 'Loud, impulsive, party lover.', tags: ['loud', 'spontaneous'] },
      ideal_partner: { summary: 'A calm, grounded intellectual.', tags: ['calm', 'grounded', 'intellectual'] },
      psychological_insights: { attachmentStyle: 'secure' },
      summary: 'Avery, 27.',
    },
    candidates: [
      {
        id: 'p4-c1',
        name: 'Quinn',
        persona: { summary: 'Calm, grounded intellectual.', tags: ['calm', 'grounded', 'intellectual'] },
        // But Quinn explicitly wants a quiet partner, not a party lover.
        ideal_partner: { summary: 'Quiet, introspective, low-key.', tags: ['quiet', 'introspective'] },
        psychological_insights: { attachmentStyle: 'secure' },
        summary: 'Quinn, 30.',
      },
    ],
    expected: [
      {
        candidateId: 'p4-c1',
        expectedFinalScore: 45,
        expectedReasoning: 'User fulfilled (high unidirectional) but reciprocity is low — Quinn would not feel fulfilled by Avery. The 50/50 formula pulls the final score down.',
        shouldTriggerDealBreaker: false,
      },
    ],
  },
];

// 4 default strategies seeded on first load. Match the price table in model-prices.ts.
export const seedStrategies: Strategy[] = [
  {
    id: 'gemini-flash-default',
    name: 'Gemini 2.5 Flash (default)',
    model: 'google/gemini-2.5-flash',
    promptVariant: 'default',
    runCount: 1,
  },
  {
    id: 'claude-sonnet-default',
    name: 'Claude 3.5 Sonnet (default)',
    model: 'anthropic/claude-3.5-sonnet',
    promptVariant: 'default',
    runCount: 1,
  },
  {
    id: 'gpt-4o-mini-default',
    name: 'GPT-4o mini (default)',
    model: 'openai/gpt-4o-mini',
    promptVariant: 'default',
    runCount: 1,
  },
  {
    id: 'llama-3-8b-budget',
    name: 'Llama 3 8B (budget)',
    model: 'meta-llama/llama-3-8b-instruct',
    promptVariant: 'default',
    runCount: 1,
  },
];
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/eval/seed-data.ts
git commit -m "$(cat <<'EOF'
feat(eval): add seed data (4 pairs + 4 strategies)

Hardcoded test pairs exercising each scoring mechanic: high match,
deal-breaker, medium overlap, and asymmetric (reciprocity test).
Four strategies seeded including the llama-3-8b budget baseline.
Expected scores are placeholders — relabel from the /eval UI.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Storage module (TDD)

**Files:**
- Create: `src/lib/eval/store.test.ts` (write FIRST)
- Create: `src/lib/eval/store.ts` (write AFTER)

- [ ] **Step 1: Write the failing test file**

Create `src/lib/eval/store.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { LocalStorageEvalStore } from './store';
import type { EvalPair, Strategy, RunResult } from './types';

function samplePair(id: string): EvalPair {
  return {
    id,
    label: `pair ${id}`,
    currentUser: {
      id: 'u1',
      name: 'User 1',
      persona: { summary: 's', tags: ['a'] },
      ideal_partner: { summary: 's', tags: ['b'] },
      summary: 'u1',
    },
    candidates: [
      {
        id: 'c1',
        name: 'Candidate 1',
        persona: { summary: 's', tags: ['a'] },
        ideal_partner: { summary: 's', tags: ['b'] },
        summary: 'c1',
      },
    ],
    expected: [
      { candidateId: 'c1', expectedFinalScore: 70, expectedReasoning: 'ok' },
    ],
  };
}

function sampleStrategy(id: string): Strategy {
  return {
    id,
    name: id,
    model: 'google/gemini-2.5-flash',
    promptVariant: 'default',
    runCount: 1,
  };
}

function sampleResult(id: string, strategyId: string, pairId: string): RunResult {
  return {
    id,
    strategyId,
    pairId,
    timestamp: new Date().toISOString(),
    output: null,
    metrics: null,
    error: 'test',
  };
}

describe('LocalStorageEvalStore', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('round-trips a saved pair', async () => {
    const store = new LocalStorageEvalStore({ skipSeeding: true });
    await store.savePair(samplePair('p1'));
    const pairs = await store.getPairs();
    expect(pairs).toHaveLength(1);
    expect(pairs[0].id).toBe('p1');
  });

  it('deletes a pair by id', async () => {
    const store = new LocalStorageEvalStore({ skipSeeding: true });
    await store.savePair(samplePair('p1'));
    await store.savePair(samplePair('p2'));
    await store.deletePair('p1');
    const pairs = await store.getPairs();
    expect(pairs).toHaveLength(1);
    expect(pairs[0].id).toBe('p2');
  });

  it('seeds default pairs and strategies on first access when seeding is enabled', async () => {
    const store = new LocalStorageEvalStore(); // seeding on by default
    const pairs = await store.getPairs();
    const strategies = await store.getStrategies();
    expect(pairs.length).toBeGreaterThan(0);
    expect(strategies.length).toBeGreaterThan(0);
    // Seeded strategies should include the llama budget baseline
    expect(strategies.some(s => s.id === 'llama-3-8b-budget')).toBe(true);
  });

  it('does not re-seed if data already exists', async () => {
    const store1 = new LocalStorageEvalStore({ skipSeeding: true });
    await store1.savePair(samplePair('only-one'));

    const store2 = new LocalStorageEvalStore(); // seeding on
    const pairs = await store2.getPairs();
    expect(pairs).toHaveLength(1);
    expect(pairs[0].id).toBe('only-one');
  });

  it('round-trips and clears results', async () => {
    const store = new LocalStorageEvalStore({ skipSeeding: true });
    await store.saveResult(sampleResult('r1', 's1', 'p1'));
    await store.saveResult(sampleResult('r2', 's1', 'p1'));
    let results = await store.getResults();
    expect(results).toHaveLength(2);

    await store.clearResults();
    results = await store.getResults();
    expect(results).toHaveLength(0);
  });

  it('returns empty arrays under SSR (window undefined)', async () => {
    // Simulate SSR by removing window temporarily.
    const originalWindow = globalThis.window;
    // @ts-expect-error simulate SSR
    delete globalThis.window;

    const store = new LocalStorageEvalStore({ skipSeeding: true });
    expect(await store.getPairs()).toEqual([]);
    expect(await store.getStrategies()).toEqual([]);
    expect(await store.getResults()).toEqual([]);

    globalThis.window = originalWindow;
  });
});
```

- [ ] **Step 2: Run tests — verify failure**

Run: `npm test -- store`
Expected: All fail with "Cannot find module './store'".

- [ ] **Step 3: Implement `src/lib/eval/store.ts`**

```ts
import {
  EvalStorageFullError,
  type EvalPair,
  type Strategy,
  type RunResult,
} from './types';
import { seedPairs, seedStrategies } from './seed-data';

export interface EvalStore {
  getPairs(): Promise<EvalPair[]>;
  savePair(pair: EvalPair): Promise<void>;
  deletePair(id: string): Promise<void>;

  getStrategies(): Promise<Strategy[]>;
  saveStrategy(s: Strategy): Promise<void>;
  deleteStrategy(id: string): Promise<void>;

  getResults(): Promise<RunResult[]>;
  saveResult(r: RunResult): Promise<void>;
  clearResults(): Promise<void>;
}

const KEYS = {
  pairs: 'eval.pairs',
  strategies: 'eval.strategies',
  results: 'eval.results',
} as const;

interface StoreOptions {
  // Disable automatic seeding on first read. Used in tests.
  skipSeeding?: boolean;
}

export class LocalStorageEvalStore implements EvalStore {
  private seeded = false;
  constructor(private readonly options: StoreOptions = {}) {}

  // --- pairs ---

  async getPairs(): Promise<EvalPair[]> {
    if (!this.isBrowser()) return [];
    this.seedIfNeeded();
    return this.read<EvalPair[]>(KEYS.pairs, []);
  }

  async savePair(pair: EvalPair): Promise<void> {
    if (!this.isBrowser()) return;
    this.seedIfNeeded();
    const pairs = this.read<EvalPair[]>(KEYS.pairs, []);
    const idx = pairs.findIndex(p => p.id === pair.id);
    if (idx >= 0) pairs[idx] = pair;
    else pairs.push(pair);
    this.write(KEYS.pairs, pairs);
  }

  async deletePair(id: string): Promise<void> {
    if (!this.isBrowser()) return;
    const pairs = this.read<EvalPair[]>(KEYS.pairs, []);
    this.write(KEYS.pairs, pairs.filter(p => p.id !== id));
  }

  // --- strategies ---

  async getStrategies(): Promise<Strategy[]> {
    if (!this.isBrowser()) return [];
    this.seedIfNeeded();
    return this.read<Strategy[]>(KEYS.strategies, []);
  }

  async saveStrategy(s: Strategy): Promise<void> {
    if (!this.isBrowser()) return;
    this.seedIfNeeded();
    const strategies = this.read<Strategy[]>(KEYS.strategies, []);
    const idx = strategies.findIndex(x => x.id === s.id);
    if (idx >= 0) strategies[idx] = s;
    else strategies.push(s);
    this.write(KEYS.strategies, strategies);
  }

  async deleteStrategy(id: string): Promise<void> {
    if (!this.isBrowser()) return;
    const strategies = this.read<Strategy[]>(KEYS.strategies, []);
    this.write(KEYS.strategies, strategies.filter(x => x.id !== id));
  }

  // --- results ---

  async getResults(): Promise<RunResult[]> {
    if (!this.isBrowser()) return [];
    return this.read<RunResult[]>(KEYS.results, []);
  }

  async saveResult(r: RunResult): Promise<void> {
    if (!this.isBrowser()) return;
    const results = this.read<RunResult[]>(KEYS.results, []);
    results.push(r);
    try {
      this.write(KEYS.results, results);
    } catch (err) {
      if (err instanceof Error && err.name === 'QuotaExceededError') {
        throw new EvalStorageFullError(
          'Browser storage is full. Clear old eval results from the Results tab.',
        );
      }
      throw err;
    }
  }

  async clearResults(): Promise<void> {
    if (!this.isBrowser()) return;
    this.write(KEYS.results, []);
  }

  // --- helpers ---

  private isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  }

  private read<T>(key: string, fallback: T): T {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      // Corrupt entry — don't swallow silently, but don't crash the UI either.
      console.error(`[LocalStorageEvalStore] corrupt entry for ${key}, resetting`);
      return fallback;
    }
  }

  private write<T>(key: string, value: T): void {
    window.localStorage.setItem(key, JSON.stringify(value));
  }

  private seedIfNeeded(): void {
    if (this.seeded || this.options.skipSeeding) return;
    this.seeded = true;

    if (!window.localStorage.getItem(KEYS.pairs)) {
      this.write(KEYS.pairs, seedPairs);
    }
    if (!window.localStorage.getItem(KEYS.strategies)) {
      this.write(KEYS.strategies, seedStrategies);
    }
  }
}
```

- [ ] **Step 4: Run tests — verify all pass**

Run: `npm test -- store`
Expected: All 6 tests pass (seed-data exists from Task 4, so the import resolves).

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/eval/store.ts src/lib/eval/store.test.ts
git commit -m "$(cat <<'EOF'
feat(eval): add LocalStorageEvalStore with SSR-safe guards

Implements the EvalStore interface over browser localStorage. All
methods guard with typeof window checks so the module is safe to
import from server components. Auto-seeds from seed-data.ts on first
access. Tests written first (TDD).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Prompts registry

**Files:**
- Create: `src/lib/eval/prompts.ts`
- Create: `src/lib/eval/prompts.test.ts`

This ports the current `find-matches-flow.ts` prompt (which uses Handlebars via Genkit) to a plain TypeScript template-literal function. The content is identical — only the rendering mechanism changes. Also adds a `simplified` variant for baseline comparison.

- [ ] **Step 1: Create `src/lib/eval/prompts.ts`**

```ts
import type { EvalProfile, PromptVariant } from './types';

// Input shape mirrors FindMatchesInputSchema from src/ai/flows/find-matches-flow.ts
// (without the Zod wrapper — just plain types).
export interface PromptInput {
  currentUser: EvalProfile;
  potentialMatches: EvalProfile[];
}

// Registry: variant name → function that produces the full prompt string.
export const promptVariants: Record<PromptVariant, (input: PromptInput) => string> = {
  default: buildDefaultPrompt,
  simplified: buildSimplifiedPrompt,
};

// Port of the current find-matches-flow.ts prompt from Handlebars to template literals.
// IMPORTANT: keep the content identical to the Genkit prompt — this is the baseline.
// If you intentionally update this variant, re-run the snapshot test and update it.
function buildDefaultPrompt({ currentUser, potentialMatches }: PromptInput): string {
  const cuTags = currentUser.persona.tags.join(', ');
  const cuIdealTags = currentUser.ideal_partner.tags.join(', ');

  const cuInsightsBlock = (() => {
    const pi = currentUser.psychological_insights;
    if (!pi) return '';
    return `
  Attachment Style: ${pi.attachmentStyle ?? ''}
  Core Need: ${pi.coreValueVsSurfaceDesire?.core ?? ''}
  Silent Deal-Breakers: ${(pi.shadowSelf?.silentDealBreakers ?? []).join(', ')}
  Recurring Needs: ${pi.shadowSelf?.recurringNeeds ?? ''}
  Behavioral Insights: ${pi.behavioralInsights ?? ''}
`;
  })();

  const matchesSection = potentialMatches.map(m => {
    const mTags = m.persona.tags.join(', ');
    const mIdealTags = m.ideal_partner.tags.join(', ');
    const mInsights = (() => {
      const pi = m.psychological_insights;
      if (!pi) return '';
      return `
  Attachment Style: ${pi.attachmentStyle ?? ''}
  Core Need: ${pi.coreValueVsSurfaceDesire?.core ?? ''}
  Silent Deal-Breakers: ${(pi.shadowSelf?.silentDealBreakers ?? []).join(', ')}
`;
    })();

    return `---
ID: ${m.id}
Name: ${m.name}
Persona: ${m.persona.summary}
Tags: ${mTags}
Ideal Partner: ${m.ideal_partner.summary}
Ideal Partner Tags: ${mIdealTags}${mInsights}
Summary: ${m.summary}`;
  }).join('\n');

  return `You are a high-end Relationship Psychologist and Matching Specialist for TrueVibe.
Your task is to calculate compatibility scores (0-100) between a User and Potential Matches.

## CRITICAL: Reciprocity First Philosophy
The most fulfilling matches are MUTUAL. A match where the user finds them fulfilling but they wouldn't find the user fulfilling leads to rejection, frustration, and wasted time.
You MUST calculate BOTH directions:
1. How fulfilled the user would feel with this match (unidirectional)
2. How likely the match would also feel fulfilled by the user (reciprocity) — check if the user's persona matches the match's ideal_partner profile

## Explicit Scoring Rubric (Use This!)

### Attachment Style Compatibility Matrix (+25 points max)
| User \\ Match | Secure | Anxious | Avoidant |
|--------------|--------|---------|----------|
| Secure       | +25    | +20     | +10      |
| Anxious      | +20    | +15     | -20      |
| Avoidant     | +10    | -20     | +20      |

### Core Value Alignment (+20 points max)
- Match addresses user's CORE need (not just surface want): +20
- Partial alignment: +10
- No alignment: 0

### Ideal Partner Fit (+20 points max)
- User's persona matches match's ideal_partner: +20
- 2-3 tag overlap: +12
- 1 tag overlap: +5
- No overlap: 0

### Shadow Self Check (+10 points max)
- Match addresses user's recurring needs: +10
- No conflict but no alignment: +3
- Match triggers silent deal-breaker: **FAIL** (score = 0, explain in failReason)

### Vibe/Communication (+5 points max)
- Behavioral insights align: +5

## Deal-Breaker Fail-Fast Rules (Score = 0)
If ANY of these are true, the match is automatically disqualified:
1. Match's persona triggers user's silent deal-breakers (from shadowSelf.silentDealBreakers)
2. User's persona contains match's explicit deal-breakers (check each match's ideal_partner)
3. Attachment style conflict: Anxious + Avoidant pairing

## Reciprocity Calculation
For each potential match, also evaluate:
"Would {match.name} find ${currentUser.name} fulfilling?"
- Check if currentUser's persona matches the potential match's ideal_partner
- Check if currentUser's psychological profile is compatible with what the match likely needs

## Final Score Formula
finalScore = (reciprocityScore * 0.5) + (unidirectionalScore * 0.5)
Rationale: A match where BOTH people feel fulfilled is 50% more valuable than one-way fulfillment.

## Current User Profile:
Name: ${currentUser.name}
Persona: ${currentUser.persona.summary}
Tags: ${cuTags}

## User's Ideal Partner:
Desire: ${currentUser.ideal_partner.summary}
Ideal Tags: ${cuIdealTags}

## User's Psychological Insights:${cuInsightsBlock}

## Potential Matches:
${matchesSection}

For EACH potential match, calculate:
1. unidirectionalScore: How fulfilled the user would be (0-100)
2. reciprocityScore: How likely the match would also be fulfilled by the user (0-100)
3. finalScore: Weighted average
4. failReason: If score = 0, explain which deal-breaker triggered
5. reason: 2-3 sentence explanation

Rank ALL matches by finalScore (highest first). Even matches with score 0 should be listed with failReason.

You MUST return valid JSON matching this exact schema (no markdown, no code fences):
{
  "matches": [
    {
      "targetUserId": "string",
      "unidirectionalScore": number,
      "reciprocityScore": number,
      "finalScore": number,
      "failReason": "string (optional)",
      "reason": "string"
    }
  ]
}`;
}

// Short variant — baseline to compare prompt engineering impact.
function buildSimplifiedPrompt({ currentUser, potentialMatches }: PromptInput): string {
  const matchesList = potentialMatches.map(m =>
    `- ${m.id}: ${m.name} — ${m.persona.summary}. Wants: ${m.ideal_partner.summary}`
  ).join('\n');

  return `Score dating compatibility 0-100 for each candidate vs the user.

User: ${currentUser.name}. ${currentUser.persona.summary}
Wants: ${currentUser.ideal_partner.summary}

Candidates:
${matchesList}

Return JSON: {"matches":[{"targetUserId":"id","unidirectionalScore":N,"reciprocityScore":N,"finalScore":N,"reason":"text"}]}`;
}
```

- [ ] **Step 2: Create `src/lib/eval/prompts.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { promptVariants, type PromptInput } from './prompts';

const fixture: PromptInput = {
  currentUser: {
    id: 'u1',
    name: 'Alex',
    persona: { summary: 'Thoughtful creative.', tags: ['creative', 'loyal'] },
    ideal_partner: { summary: 'Curious and kind.', tags: ['curious', 'kind'] },
    psychological_insights: {
      attachmentStyle: 'secure',
      coreValueVsSurfaceDesire: { core: 'being understood' },
      shadowSelf: { silentDealBreakers: ['dishonesty'], recurringNeeds: 'attunement' },
      behavioralInsights: 'Writes long messages.',
    },
    summary: 'Alex, 28.',
  },
  potentialMatches: [
    {
      id: 'c1',
      name: 'Sam',
      persona: { summary: 'Warm and grounded.', tags: ['curious', 'kind'] },
      ideal_partner: { summary: 'Creative type.', tags: ['creative', 'loyal'] },
      psychological_insights: { attachmentStyle: 'secure' },
      summary: 'Sam, 29.',
    },
  ],
};

describe('promptVariants', () => {
  it('default variant matches snapshot', () => {
    const rendered = promptVariants.default(fixture);
    expect(rendered).toMatchSnapshot();
  });

  it('default variant includes the reciprocity philosophy section', () => {
    const rendered = promptVariants.default(fixture);
    expect(rendered).toContain('Reciprocity First Philosophy');
    expect(rendered).toContain('finalScore = (reciprocityScore * 0.5) + (unidirectionalScore * 0.5)');
  });

  it('default variant interpolates user + candidate data', () => {
    const rendered = promptVariants.default(fixture);
    expect(rendered).toContain('Name: Alex');
    expect(rendered).toContain('ID: c1');
    expect(rendered).toContain('Name: Sam');
  });

  it('simplified variant matches snapshot', () => {
    const rendered = promptVariants.simplified(fixture);
    expect(rendered).toMatchSnapshot();
  });

  it('simplified variant is meaningfully shorter than default', () => {
    const def = promptVariants.default(fixture).length;
    const simple = promptVariants.simplified(fixture).length;
    expect(simple).toBeLessThan(def / 2);
  });
});
```

- [ ] **Step 3: Run tests — verify snapshots are created on first run**

Run: `npm test -- prompts`
Expected: All tests pass (first run creates `__snapshots__/prompts.test.ts.snap`).

- [ ] **Step 4: Commit**

```bash
git add src/lib/eval/prompts.ts src/lib/eval/prompts.test.ts src/lib/eval/__snapshots__/
git commit -m "$(cat <<'EOF'
feat(eval): port find-matches prompt to template literals + simplified variant

Ports the Handlebars-based Genkit prompt verbatim into a plain
TypeScript function so the eval framework can use it without Genkit's
template engine. Adds a 'simplified' variant for baseline comparison
and a snapshot test that catches accidental drift.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: OpenRouter client (server-only)

**Files:**
- Create: `src/ai/eval/openrouter-client.ts`

No unit test — this is a thin HTTP wrapper. Task 8 covers it via mocks in run-strategy tests. Manual smoke test documented in the spec.

- [ ] **Step 1: Create `src/ai/eval/openrouter-client.ts`**

```ts
import 'server-only';
import { EvalConfigError } from '@/lib/eval/types';

export interface OpenRouterCallParams {
  model: string;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  // When true, we ask the model for JSON output. Not all OpenRouter providers honor
  // response_format strictly, so the prompt itself must also demand JSON.
  wantsJson?: boolean;
}

export interface OpenRouterCallResult {
  content: string;
  promptTokens: number;
  completionTokens: number;
}

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

// Thin wrapper around OpenRouter's chat/completions endpoint.
// Throws EvalConfigError if API key is missing.
// Throws a regular Error on non-2xx responses — caller (run-strategy.ts) decides how to surface it.
export async function callOpenRouter(params: OpenRouterCallParams): Promise<OpenRouterCallResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new EvalConfigError(
      'OPENROUTER_API_KEY is not set. Add it to .env.local and restart the dev server.',
    );
  }

  const body: Record<string, unknown> = {
    model: params.model,
    messages: params.messages,
  };
  if (params.wantsJson) {
    body.response_format = { type: 'json_object' };
  }

  const res = await fetch(OPENROUTER_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      // OpenRouter requires these headers for proper routing & attribution.
      'HTTP-Referer': 'https://truevibe.local/eval',
      'X-Title': 'TrueVibe Eval Framework',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`OpenRouter ${res.status} ${res.statusText}: ${errText.slice(0, 500)}`);
  }

  type OpenRouterResponse = {
    choices: Array<{ message: { content: string } }>;
    usage?: { prompt_tokens: number; completion_tokens: number };
  };
  const json = (await res.json()) as OpenRouterResponse;

  const content = json.choices?.[0]?.message?.content ?? '';
  return {
    content,
    promptTokens: json.usage?.prompt_tokens ?? 0,
    completionTokens: json.usage?.completion_tokens ?? 0,
  };
}
```

- [ ] **Step 2: Check if `server-only` package is installed**

Run: `npm list server-only 2>&1 | head -5`

If it reports `(empty)` or the package is missing, install it:

```bash
npm install server-only
```

Expected: `server-only` now appears in `package.json` dependencies.

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/ai/eval/openrouter-client.ts package.json package-lock.json
git commit -m "$(cat <<'EOF'
feat(eval): add OpenRouter client (server-only)

Thin wrapper around OpenRouter's chat/completions endpoint. Reads
OPENROUTER_API_KEY from process.env — never reaches the browser.
Throws EvalConfigError on missing key, plain Error on HTTP failures.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Add environment variable template

**Files:**
- Create: `.env.example`

- [ ] **Step 1: Create `.env.example`**

```
# OpenRouter API key for the /eval framework.
# Get one at https://openrouter.ai/keys
# Put your real key in .env.local (which is already gitignored).
OPENROUTER_API_KEY=
```

- [ ] **Step 2: Verify `.env.local` is gitignored**

Run: `git check-ignore .env.local && echo "ok" || echo "NOT IGNORED"`
Expected: `ok` (the existing `.gitignore` has `.env*` on line 41).

- [ ] **Step 3: Commit**

```bash
git add .env.example
git commit -m "$(cat <<'EOF'
chore: add .env.example with OPENROUTER_API_KEY

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Run-strategy server action (TDD)

**Files:**
- Create: `src/ai/eval/run-strategy.test.ts` (write FIRST)
- Create: `src/ai/eval/run-strategy.ts` (write AFTER)

- [ ] **Step 1: Write the failing test file**

Create `src/ai/eval/run-strategy.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Strategy, EvalPair } from '@/lib/eval/types';

// Mock the openrouter-client module BEFORE importing run-strategy.
vi.mock('./openrouter-client', () => ({
  callOpenRouter: vi.fn(),
}));

// Mock server-only (it throws when imported from a test normally).
vi.mock('server-only', () => ({}));

import { callOpenRouter } from './openrouter-client';
import { runStrategy } from './run-strategy';

const strategy: Strategy = {
  id: 's-test',
  name: 'Test',
  model: 'google/gemini-2.5-flash',
  promptVariant: 'default',
  runCount: 1,
};

const pair: EvalPair = {
  id: 'p-test',
  label: 'test',
  currentUser: {
    id: 'u1',
    name: 'Alex',
    persona: { summary: 'Creative.', tags: ['creative'] },
    ideal_partner: { summary: 'Kind.', tags: ['kind'] },
    summary: 'u1',
  },
  candidates: [
    {
      id: 'c1',
      name: 'Sam',
      persona: { summary: 'Warm.', tags: ['kind'] },
      ideal_partner: { summary: 'Creative.', tags: ['creative'] },
      summary: 'c1',
    },
  ],
  expected: [
    {
      candidateId: 'c1',
      expectedFinalScore: 85,
      expectedReasoning: 'good',
      shouldTriggerDealBreaker: false,
    },
  ],
};

describe('runStrategy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('happy path: valid JSON output → RunResult with populated metrics', async () => {
    vi.mocked(callOpenRouter).mockResolvedValue({
      content: JSON.stringify({
        matches: [
          {
            targetUserId: 'c1',
            unidirectionalScore: 85,
            reciprocityScore: 85,
            finalScore: 85,
            reason: 'good fit',
          },
        ],
      }),
      promptTokens: 1000,
      completionTokens: 200,
    });

    const result = await runStrategy(strategy, pair);

    expect(result.error).toBeUndefined();
    expect(result.output?.matches).toHaveLength(1);
    expect(result.metrics).not.toBeNull();
    expect(result.metrics!.scoreDeltaAvg).toBe(0);
    expect(result.metrics!.costUsd).not.toBeNull();
    expect(result.metrics!.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('malformed JSON → RunResult with error + rawOutput preserved', async () => {
    vi.mocked(callOpenRouter).mockResolvedValue({
      content: 'this is not JSON {oops',
      promptTokens: 500,
      completionTokens: 10,
    });

    const result = await runStrategy(strategy, pair);

    expect(result.error).toBeDefined();
    expect(result.error).toMatch(/parse|JSON/i);
    expect(result.rawOutput).toBe('this is not JSON {oops');
    expect(result.output).toBeNull();
    expect(result.metrics).toBeNull();
  });

  it('empty content → RunResult with empty-content error', async () => {
    vi.mocked(callOpenRouter).mockResolvedValue({
      content: '',
      promptTokens: 500,
      completionTokens: 0,
    });

    const result = await runStrategy(strategy, pair);

    expect(result.error).toMatch(/empty/i);
    expect(result.metrics).toBeNull();
  });

  it('LLM drops a candidate → RunResult with MetricsInvariantError message and missing IDs', async () => {
    const pairWithTwoCandidates: EvalPair = {
      ...pair,
      candidates: [
        ...pair.candidates,
        {
          id: 'c2',
          name: 'Riley',
          persona: { summary: 'Quiet.', tags: ['quiet'] },
          ideal_partner: { summary: 'Anyone.', tags: [] },
          summary: 'c2',
        },
      ],
      expected: [
        ...pair.expected,
        { candidateId: 'c2', expectedFinalScore: 40, expectedReasoning: 'meh' },
      ],
    };

    vi.mocked(callOpenRouter).mockResolvedValue({
      content: JSON.stringify({
        matches: [
          {
            targetUserId: 'c1',
            unidirectionalScore: 85,
            reciprocityScore: 85,
            finalScore: 85,
            reason: 'good',
          },
          // c2 missing!
        ],
      }),
      promptTokens: 1000,
      completionTokens: 200,
    });

    const result = await runStrategy(strategy, pairWithTwoCandidates);

    expect(result.error).toMatch(/c2/);
    expect(result.output).not.toBeNull(); // parsed OK, metrics failed
    expect(result.metrics).toBeNull();
  });

  it('OpenRouter throws → RunResult with error, no crash', async () => {
    vi.mocked(callOpenRouter).mockRejectedValue(new Error('OpenRouter 429: rate limited'));

    const result = await runStrategy(strategy, pair);

    expect(result.error).toMatch(/rate limited/);
    expect(result.output).toBeNull();
    expect(result.metrics).toBeNull();
  });

  it('cost calculation uses token counts and price table', async () => {
    vi.mocked(callOpenRouter).mockResolvedValue({
      content: JSON.stringify({
        matches: [
          {
            targetUserId: 'c1',
            unidirectionalScore: 85,
            reciprocityScore: 85,
            finalScore: 85,
            reason: 'ok',
          },
        ],
      }),
      promptTokens: 1_000_000, // 1M input tokens
      completionTokens: 1_000_000, // 1M output tokens
    });

    const result = await runStrategy(strategy, pair);
    // gemini-2.5-flash: 0.075 + 0.30 = 0.375 per 1M/1M split
    expect(result.metrics?.costUsd).toBeCloseTo(0.375, 4);
  });
});
```

- [ ] **Step 2: Run tests — verify failure**

Run: `npm test -- run-strategy`
Expected: All fail with "Cannot find module './run-strategy'".

- [ ] **Step 3: Implement `src/ai/eval/run-strategy.ts`**

```ts
'use server';

import {
  MetricsInvariantError,
  type Strategy,
  type EvalPair,
  type RunResult,
  type FindMatchesOutput,
} from '@/lib/eval/types';
import { promptVariants } from '@/lib/eval/prompts';
import { compareToLabels } from '@/lib/eval/metrics';
import { calculateCost } from '@/lib/eval/model-prices';
import { callOpenRouter } from './openrouter-client';

// Server action: runs one strategy against one pair and returns a RunResult.
// Never throws — always returns a RunResult, populating `error` on failure
// so the caller can continue the sweep and surface errors in the UI.
export async function runStrategy(strategy: Strategy, pair: EvalPair): Promise<RunResult> {
  const runId = `${strategy.id}__${pair.id}__${Date.now()}`;
  const timestamp = new Date().toISOString();

  const promptBuilder = promptVariants[strategy.promptVariant];
  if (!promptBuilder) {
    return baseResult(runId, strategy.id, pair.id, timestamp, {
      error: `Unknown prompt variant: ${strategy.promptVariant}`,
    });
  }

  const promptText = promptBuilder({
    currentUser: pair.currentUser,
    potentialMatches: pair.candidates,
  });

  const startTime = Date.now();
  let callResult;
  try {
    callResult = await callOpenRouter({
      model: strategy.model,
      messages: [{ role: 'user', content: promptText }],
      wantsJson: true,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return baseResult(runId, strategy.id, pair.id, timestamp, {
      error: message,
      latencyMs: Date.now() - startTime,
    });
  }
  const latencyMs = Date.now() - startTime;

  if (!callResult.content || callResult.content.trim() === '') {
    return baseResult(runId, strategy.id, pair.id, timestamp, {
      error: 'LLM returned empty content',
      rawOutput: callResult.content,
      latencyMs,
    });
  }

  // Some models wrap JSON in ```json fences even when asked not to. Strip them.
  const cleaned = stripCodeFences(callResult.content);

  let parsed: FindMatchesOutput;
  try {
    parsed = JSON.parse(cleaned) as FindMatchesOutput;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return baseResult(runId, strategy.id, pair.id, timestamp, {
      error: `Failed to parse LLM output as JSON: ${message}`,
      rawOutput: callResult.content,
      latencyMs,
    });
  }

  if (!parsed || !Array.isArray(parsed.matches)) {
    return baseResult(runId, strategy.id, pair.id, timestamp, {
      error: 'LLM output missing "matches" array',
      rawOutput: callResult.content,
      latencyMs,
    });
  }

  let qualityMetrics;
  try {
    qualityMetrics = compareToLabels(parsed, pair.expected);
  } catch (err) {
    const message = err instanceof MetricsInvariantError
      ? `Incomplete output: ${err.message}`
      : `Metrics error: ${err instanceof Error ? err.message : String(err)}`;
    return baseResult(runId, strategy.id, pair.id, timestamp, {
      error: message,
      output: parsed,
      rawOutput: callResult.content,
      latencyMs,
    });
  }

  const costUsd = calculateCost(
    strategy.model,
    callResult.promptTokens,
    callResult.completionTokens,
  );

  return {
    id: runId,
    strategyId: strategy.id,
    pairId: pair.id,
    timestamp,
    output: parsed,
    rawOutput: callResult.content,
    metrics: {
      ...qualityMetrics,
      costUsd,
      latencyMs,
    },
  };
}

// Helper: build a RunResult with defaults.
function baseResult(
  id: string,
  strategyId: string,
  pairId: string,
  timestamp: string,
  overrides: Partial<RunResult>,
): RunResult {
  return {
    id,
    strategyId,
    pairId,
    timestamp,
    output: null,
    metrics: null,
    ...overrides,
  };
}

// Strip ```json fences that some models add despite instructions.
function stripCodeFences(s: string): string {
  const trimmed = s.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fenceMatch) return fenceMatch[1].trim();
  return trimmed;
}
```

- [ ] **Step 4: Run tests — verify all pass**

Run: `npm test -- run-strategy`
Expected: All 6 tests pass.

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: All tests across metrics, store, prompts, and run-strategy pass. No failures.

- [ ] **Step 6: Run typecheck**

Run: `npm run typecheck`
Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add src/ai/eval/run-strategy.ts src/ai/eval/run-strategy.test.ts
git commit -m "$(cat <<'EOF'
feat(eval): add runStrategy server action with error handling

Server action that runs one strategy against one pair, measuring
latency and cost. Never throws — returns RunResult with error field
on failure so a sweep can continue past individual failures.
Handles: API errors, empty content, malformed JSON, code fences,
and MetricsInvariantError (LLM dropping candidates).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Eval page — shell + Dataset tab

**Files:**
- Create: `src/app/eval/page.tsx`

The UI is a single client-component page with four tabs. We build it in three tasks (10, 11, 12) so each commit remains reviewable.

- [ ] **Step 1: Create `src/app/eval/page.tsx` with the shell and Dataset tab**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { LocalStorageEvalStore, type EvalStore } from '@/lib/eval/store';
import type { EvalPair } from '@/lib/eval/types';

export default function EvalPage() {
  const [store, setStore] = useState<EvalStore | null>(null);
  const [pairs, setPairs] = useState<EvalPair[]>([]);
  const [editingPair, setEditingPair] = useState<EvalPair | null>(null);

  // Construct store inside useEffect — localStorage is unavailable during SSR.
  useEffect(() => {
    const s = new LocalStorageEvalStore();
    setStore(s);
    s.getPairs().then(setPairs);
  }, []);

  async function handleSavePair(updated: EvalPair) {
    if (!store) return;
    await store.savePair(updated);
    setPairs(await store.getPairs());
    setEditingPair(null);
  }

  return (
    <div className="max-w-6xl mx-auto p-6 pt-20 min-h-screen">
      <header className="mb-8">
        <h1 className="text-3xl font-black text-white">Find-Matches Eval</h1>
        <p className="text-white/60">Compare LLMs, prompts, and strategies against labeled pairs.</p>
      </header>

      <Tabs defaultValue="dataset">
        <TabsList>
          <TabsTrigger value="dataset">Dataset</TabsTrigger>
          <TabsTrigger value="strategies">Strategies</TabsTrigger>
          <TabsTrigger value="run">Run</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
        </TabsList>

        <TabsContent value="dataset" className="mt-6">
          <Card className="p-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Label</TableHead>
                  <TableHead>Candidates</TableHead>
                  <TableHead>Expected scores</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pairs.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.label}</TableCell>
                    <TableCell>{p.candidates.length}</TableCell>
                    <TableCell>{p.expected.map(e => e.expectedFinalScore).join(', ')}</TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" onClick={() => setEditingPair(p)}>
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="strategies">Strategies tab (Task 11)</TabsContent>
        <TabsContent value="run">Run tab (Task 12)</TabsContent>
        <TabsContent value="results">Results tab (Task 12)</TabsContent>
      </Tabs>

      <EditPairDialog
        pair={editingPair}
        onClose={() => setEditingPair(null)}
        onSave={handleSavePair}
      />
    </div>
  );
}

function EditPairDialog({
  pair,
  onClose,
  onSave,
}: {
  pair: EvalPair | null;
  onClose: () => void;
  onSave: (p: EvalPair) => void;
}) {
  const [draft, setDraft] = useState<EvalPair | null>(null);
  useEffect(() => setDraft(pair), [pair]);

  if (!draft) return null;

  function updateExpected(idx: number, score: number, reasoning: string) {
    if (!draft) return;
    const next = { ...draft, expected: [...draft.expected] };
    next.expected[idx] = { ...next.expected[idx], expectedFinalScore: score, expectedReasoning: reasoning };
    setDraft(next);
  }

  return (
    <Dialog open={!!pair} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{draft.label}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {draft.expected.map((exp, i) => {
            const candidate = draft.candidates.find(c => c.id === exp.candidateId);
            return (
              <div key={exp.candidateId} className="border rounded p-3 space-y-2">
                <div className="text-sm font-bold">{candidate?.name ?? exp.candidateId}</div>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={exp.expectedFinalScore}
                  onChange={e => updateExpected(i, Number(e.target.value), exp.expectedReasoning)}
                />
                <Input
                  value={exp.expectedReasoning}
                  onChange={e => updateExpected(i, exp.expectedFinalScore, e.target.value)}
                />
              </div>
            );
          })}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(draft)}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: 0 errors.

- [ ] **Step 3: Manual smoke test**

Run: `npm run dev`

Then in a browser, visit `http://localhost:9002/eval`.

Verify:
- The page loads without errors
- The Dataset tab shows 4 seeded pairs
- Clicking "Edit" opens the dialog and shows the current expected scores
- Changing a score and clicking Save closes the dialog and the table reflects the new value
- Reloading the page preserves the edit (localStorage working)

Stop the dev server with Ctrl-C when done.

- [ ] **Step 4: Commit**

```bash
git add src/app/eval/page.tsx
git commit -m "$(cat <<'EOF'
feat(eval): add /eval page shell with Dataset tab

Client component with tab shell (Dataset/Strategies/Run/Results).
Dataset tab reads pairs from LocalStorageEvalStore (inside useEffect
for SSR safety) and provides an edit dialog that round-trips expected
scores through the store. Other tabs are placeholders for Tasks 11-12.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Eval page — Strategies tab

**Files:**
- Modify: `src/app/eval/page.tsx`

- [ ] **Step 1: Add strategies state + handlers at the top of `EvalPage`**

In `src/app/eval/page.tsx`, add imports for `Strategy` type at the top with the other imports:

```tsx
import type { EvalPair, Strategy, PromptVariant } from '@/lib/eval/types';
```

Inside `EvalPage`, add state + effect + handlers after the existing `pairs` state:

```tsx
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [editingStrategy, setEditingStrategy] = useState<Strategy | null>(null);

  useEffect(() => {
    if (!store) return;
    store.getStrategies().then(setStrategies);
  }, [store]);

  async function handleSaveStrategy(updated: Strategy) {
    if (!store) return;
    await store.saveStrategy(updated);
    setStrategies(await store.getStrategies());
    setEditingStrategy(null);
  }

  async function handleDeleteStrategy(id: string) {
    if (!store) return;
    await store.deleteStrategy(id);
    setStrategies(await store.getStrategies());
  }

  function handleAddStrategy() {
    setEditingStrategy({
      id: `strategy-${Date.now()}`,
      name: 'New Strategy',
      model: 'google/gemini-2.5-flash',
      promptVariant: 'default',
      runCount: 1,
    });
  }
```

- [ ] **Step 2: Replace the Strategies TabsContent placeholder**

In the JSX, replace:

```tsx
        <TabsContent value="strategies">Strategies tab (Task 11)</TabsContent>
```

With:

```tsx
        <TabsContent value="strategies" className="mt-6">
          <Card className="p-4">
            <div className="flex justify-end mb-4">
              <Button onClick={handleAddStrategy}>Add Strategy</Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Prompt</TableHead>
                  <TableHead>Run count</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {strategies.map(s => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="font-mono text-xs">{s.model}</TableCell>
                    <TableCell>{s.promptVariant}</TableCell>
                    <TableCell>{s.runCount}</TableCell>
                    <TableCell className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setEditingStrategy(s)}>
                        Edit
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => handleDeleteStrategy(s.id)}>
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
```

- [ ] **Step 3: Add the `EditStrategyDialog` component at the bottom of the file**

Add the dialog render inside the JSX, right after `<EditPairDialog .../>`:

```tsx
      <EditStrategyDialog
        strategy={editingStrategy}
        onClose={() => setEditingStrategy(null)}
        onSave={handleSaveStrategy}
      />
```

Then at the bottom of the file (after `EditPairDialog`), add the `EditStrategyDialog` component:

```tsx
const KNOWN_MODELS = [
  'google/gemini-2.5-flash',
  'anthropic/claude-3.5-sonnet',
  'openai/gpt-4o-mini',
  'meta-llama/llama-3-8b-instruct',
];

function EditStrategyDialog({
  strategy,
  onClose,
  onSave,
}: {
  strategy: Strategy | null;
  onClose: () => void;
  onSave: (s: Strategy) => void;
}) {
  const [draft, setDraft] = useState<Strategy | null>(null);
  useEffect(() => setDraft(strategy), [strategy]);

  if (!draft) return null;

  return (
    <Dialog open={!!strategy} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Strategy</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold uppercase">Name</label>
            <Input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-bold uppercase">Model (OpenRouter ID)</label>
            <select
              className="w-full border rounded p-2 bg-background"
              value={draft.model}
              onChange={e => setDraft({ ...draft, model: e.target.value })}
            >
              {KNOWN_MODELS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold uppercase">Prompt variant</label>
            <select
              className="w-full border rounded p-2 bg-background"
              value={draft.promptVariant}
              onChange={e => setDraft({ ...draft, promptVariant: e.target.value as PromptVariant })}
            >
              <option value="default">default</option>
              <option value="simplified">simplified</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-bold uppercase">Run count</label>
            <Input
              type="number"
              min={1}
              max={10}
              value={draft.runCount}
              onChange={e => setDraft({ ...draft, runCount: Number(e.target.value) })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(draft)}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: 0 errors.

- [ ] **Step 5: Manual smoke test**

Run: `npm run dev`, visit `/eval`, Strategies tab.

Verify:
- Shows the 4 seeded strategies
- "Add Strategy" opens the dialog with defaults
- Editing and saving a strategy persists on reload
- Deleting a strategy removes it from the list

Stop dev server.

- [ ] **Step 6: Commit**

```bash
git add src/app/eval/page.tsx
git commit -m "$(cat <<'EOF'
feat(eval): add Strategies tab with CRUD

Add/edit/delete strategies via a dialog with model picker (from a
hardcoded list of common OpenRouter models), prompt variant selector,
and run count input. All CRUD persisted through LocalStorageEvalStore.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: Eval page — Run + Results tabs (final)

**Files:**
- Modify: `src/app/eval/page.tsx`

- [ ] **Step 1: Add results state + run logic to `EvalPage`**

Add imports:

```tsx
import { runStrategy } from '@/ai/eval/run-strategy';
import type { EvalPair, Strategy, PromptVariant, RunResult } from '@/lib/eval/types';
```

Add state and handlers inside `EvalPage`, after the strategy handlers:

```tsx
  const [results, setResults] = useState<RunResult[]>([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<string>('');
  const [selectedError, setSelectedError] = useState<RunResult | null>(null);

  useEffect(() => {
    if (!store) return;
    store.getResults().then(setResults);
  }, [store]);

  async function handleRunAll() {
    if (!store || running) return;
    setRunning(true);
    setProgress('');
    try {
      let i = 0;
      const total = strategies.length * pairs.length;
      for (const strategy of strategies) {
        for (const pair of pairs) {
          i++;
          setProgress(`Running ${strategy.name} on "${pair.label}" (${i}/${total})`);
          const result = await runStrategy(strategy, pair);
          await store.saveResult(result);
          setResults(await store.getResults());
        }
      }
      setProgress('Done.');
    } catch (err) {
      setProgress(`Failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setRunning(false);
    }
  }

  async function handleClearResults() {
    if (!store) return;
    await store.clearResults();
    setResults([]);
  }

  // Aggregate results by strategy for the Results table.
  const aggregated = strategies.map(s => {
    const strategyResults = results.filter(r => r.strategyId === s.id && r.metrics);
    if (strategyResults.length === 0) {
      return { strategy: s, runs: 0, quality: null, ranking: null, cost: null, latency: null, failed: results.filter(r => r.strategyId === s.id && r.error).length };
    }
    const avg = (fn: (r: RunResult) => number | null | undefined) => {
      const nums = strategyResults.map(fn).filter((n): n is number => typeof n === 'number');
      return nums.length === 0 ? null : nums.reduce((a, b) => a + b, 0) / nums.length;
    };
    return {
      strategy: s,
      runs: strategyResults.length,
      quality: avg(r => r.metrics?.scoreDeltaAvg),
      ranking: avg(r => r.metrics?.rankingCorrelation),
      cost: avg(r => r.metrics?.costUsd ?? null),
      latency: avg(r => r.metrics?.latencyMs),
      failed: results.filter(r => r.strategyId === s.id && r.error).length,
    };
  }).sort((a, b) => {
    // Lowest scoreDeltaAvg first. Nulls (no runs yet) go to the bottom.
    if (a.quality === null) return 1;
    if (b.quality === null) return -1;
    return a.quality - b.quality;
  });
```

- [ ] **Step 2: Replace the Run and Results TabsContent placeholders**

Replace:

```tsx
        <TabsContent value="run">Run tab (Task 12)</TabsContent>
        <TabsContent value="results">Results tab (Task 12)</TabsContent>
```

With:

```tsx
        <TabsContent value="run" className="mt-6">
          <Card className="p-6 space-y-4">
            <div className="text-sm text-white/60">
              Will run <strong>{strategies.length}</strong> strategies × <strong>{pairs.length}</strong> pairs = <strong>{strategies.length * pairs.length}</strong> total runs. Sequential to respect rate limits.
            </div>
            <Button onClick={handleRunAll} disabled={running || strategies.length === 0 || pairs.length === 0}>
              {running ? 'Running…' : 'Run all strategies × all pairs'}
            </Button>
            {progress && <div className="text-sm font-mono text-white/80">{progress}</div>}
          </Card>
        </TabsContent>

        <TabsContent value="results" className="mt-6">
          <Card className="p-4">
            <div className="flex justify-between items-center mb-4">
              <div className="text-sm text-white/60">
                {results.length} total runs stored
              </div>
              <Button variant="outline" size="sm" onClick={handleClearResults}>
                Clear all results
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Strategy</TableHead>
                  <TableHead>Runs</TableHead>
                  <TableHead>Avg Δ score</TableHead>
                  <TableHead>Ranking corr.</TableHead>
                  <TableHead>Avg cost (USD)</TableHead>
                  <TableHead>Avg latency</TableHead>
                  <TableHead>Failed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {aggregated.map(row => (
                  <TableRow key={row.strategy.id}>
                    <TableCell className="font-medium">{row.strategy.name}</TableCell>
                    <TableCell>{row.runs}</TableCell>
                    <TableCell>{row.quality === null ? '—' : `±${row.quality.toFixed(1)}`}</TableCell>
                    <TableCell>{row.ranking === null ? '—' : row.ranking.toFixed(2)}</TableCell>
                    <TableCell>{row.cost === null ? '—' : `$${row.cost.toFixed(6)}`}</TableCell>
                    <TableCell>{row.latency === null ? '—' : `${Math.round(row.latency)}ms`}</TableCell>
                    <TableCell>
                      {row.failed > 0 ? (
                        <span className="text-red-500 font-bold">{row.failed}</span>
                      ) : (
                        <span className="text-white/40">0</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {results.some(r => r.error) && (
              <div className="mt-6">
                <div className="text-sm font-bold text-white/80 mb-2">Failed runs</div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Strategy</TableHead>
                      <TableHead>Pair</TableHead>
                      <TableHead>Error</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.filter(r => r.error).map(r => (
                      <TableRow key={r.id}>
                        <TableCell>{strategies.find(s => s.id === r.strategyId)?.name ?? r.strategyId}</TableCell>
                        <TableCell>{pairs.find(p => p.id === r.pairId)?.label ?? r.pairId}</TableCell>
                        <TableCell className="max-w-xs truncate text-red-400 text-xs">{r.error}</TableCell>
                        <TableCell>
                          <Button variant="outline" size="sm" onClick={() => setSelectedError(r)}>
                            Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>
        </TabsContent>
```

- [ ] **Step 3: Add the error details dialog**

After `<EditStrategyDialog .../>` in the JSX:

```tsx
      <Dialog open={!!selectedError} onOpenChange={(open) => !open && setSelectedError(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Run error details</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div>
              <div className="text-xs font-bold uppercase text-white/60">Error</div>
              <div className="font-mono text-red-400">{selectedError?.error}</div>
            </div>
            {selectedError?.rawOutput && (
              <div>
                <div className="text-xs font-bold uppercase text-white/60">Raw LLM output</div>
                <pre className="font-mono text-xs bg-black/40 p-3 rounded whitespace-pre-wrap">
                  {selectedError.rawOutput}
                </pre>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setSelectedError(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
```

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: 0 errors.

- [ ] **Step 5: Manual end-to-end smoke test**

Create a `.env.local` file in the project root (it won't be committed — `.env*` is gitignored):

```
OPENROUTER_API_KEY=<your real OpenRouter key>
```

Run: `npm run dev`

Visit `http://localhost:9002/eval`:

Verify:
1. Dataset and Strategies tabs still work from Tasks 10-11
2. Run tab shows `4 × 4 = 16 total runs`
3. Click "Run all strategies × all pairs"
4. Progress text updates in real time as runs complete
5. Within ~30-60s, Results tab populates with one row per strategy
6. The table is sorted by "Avg Δ score" ascending (best quality first)
7. If any runs failed, a "Failed runs" section appears; clicking "Details" shows the raw LLM output
8. Reload the page — results persist
9. Click "Clear all results" — the results table empties

Stop dev server.

- [ ] **Step 6: Run the full test suite one more time**

Run: `npm test && npm run typecheck`
Expected: all tests pass, 0 typecheck errors.

- [ ] **Step 7: Commit**

```bash
git add src/app/eval/page.tsx
git commit -m "$(cat <<'EOF'
feat(eval): add Run and Results tabs

Run tab executes all strategies × all pairs sequentially via the
runStrategy server action, with live progress. Results tab aggregates
per-strategy metrics (avg score delta, ranking correlation, cost,
latency, failure count) and sorts by quality. Failed runs surface
with a details dialog showing the raw LLM output for debugging.

Completes the find-matches eval framework MVP.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Done

At this point the eval framework MVP is complete:

- `/eval` page with Dataset, Strategies, Run, and Results tabs
- 4 seeded pairs + 4 seeded strategies (Gemini Flash, Claude 3.5 Sonnet, GPT-4o mini, Llama 3 8B)
- All data persisted in browser localStorage
- LLM calls go through a server action with OpenRouter
- Cost + latency + quality metrics tracked per run
- Tests: `metrics`, `store`, `prompts`, `run-strategy` (unit + integration with mocks)
- Existing `src/ai/flows/find-matches-flow.ts`, `src/app/matches/page.tsx`, and `src/ai/genkit.ts` all untouched

**Success criteria check** (from the spec):

1. ✅ `/eval` loads with 4 seeded pairs and 4 seeded strategies
2. ✅ "Run all" shows a sorted comparison table with quality, cost, latency within ~30-60s
3. ✅ Failed runs show clearly with raw LLM output available
4. ✅ Editing a pair's expected score persists on reload
5. ✅ `npm run test` passes all unit tests
6. ✅ `npm run typecheck` passes with 0 errors
7. ✅ Existing `/matches` page continues to work unchanged

**Next steps** (out of scope for this plan):
- Migrate from localStorage to Supabase (swap `LocalStorageEvalStore` for `SupabaseEvalStore`; UI unchanged)
- Add "median of N runs" as a strategy algorithm (extend `runStrategy` to loop and aggregate)
- Fix the hardcoded Google API key in `src/ai/genkit.ts:7` (separate security task)
- Fix the incomplete profile data passed to `findMatches` in `src/app/matches/page.tsx:112-116`
