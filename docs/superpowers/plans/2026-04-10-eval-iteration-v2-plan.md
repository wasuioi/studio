# Eval Framework v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the eval framework around a pairwise text-to-text compatibility model (each row = two profile descriptions + one expected score), fix the Sonnet model bug, and ship 17 feature/polish items the user flagged after testing v1.

**Architecture:** Phase A deletes v1 eval code and stubs `page.tsx` so `typecheck` stays clean across the transition. Phase B rebuilds the logic layer bottom-up (types → prices → plan-sweep → metrics → prompts → seed-data → store → run-strategy), each with TDD. Phase C rebuilds the UI tab-by-tab (shell + Dataset → Strategies polish → Run → Results → linked items + polish).

**Tech Stack:** Next.js 15 App Router, TypeScript, Zod (used indirectly via production code; not needed here), shadcn/ui (Tabs/Dialog/Table/Input/Badge), Vitest + happy-dom (already installed from v1), OpenRouter REST API (client unchanged from v1).

**Spec:** `docs/superpowers/specs/2026-04-10-eval-iteration-v2-design.md`

**Working directory:** `/Users/pacas/studio/.worktrees/ai-eval-framework` (branch `ai-eval-framework`). v1 ships 12 commits on this branch; v2 continues on top.

---

## Task 1: Phase A — Clean slate

Delete all v1 eval logic files and stub `page.tsx`. After this commit, `typecheck` passes, `test` passes (no eval tests exist anymore), and `/eval` shows an "Under construction" message. The OpenRouter client (`src/ai/eval/openrouter-client.ts`) stays — it's unchanged in v2.

**Files:**
- Delete: `src/lib/eval/types.ts`
- Delete: `src/lib/eval/model-prices.ts`
- Delete: `src/lib/eval/metrics.ts`
- Delete: `src/lib/eval/metrics.test.ts`
- Delete: `src/lib/eval/prompts.ts`
- Delete: `src/lib/eval/prompts.test.ts`
- Delete: `src/lib/eval/__snapshots__/prompts.test.ts.snap`
- Delete: `src/lib/eval/seed-data.ts`
- Delete: `src/lib/eval/store.ts`
- Delete: `src/lib/eval/store.test.ts`
- Delete: `src/ai/eval/run-strategy.ts`
- Delete: `src/ai/eval/run-strategy.test.ts`
- Stub: `src/app/eval/page.tsx` (replace entire file with minimal under-construction view)
- Keep: `src/ai/eval/openrouter-client.ts` (unchanged)

- [ ] **Step 1: Delete v1 logic files**

Run:
```bash
rm src/lib/eval/types.ts src/lib/eval/model-prices.ts
rm src/lib/eval/metrics.ts src/lib/eval/metrics.test.ts
rm src/lib/eval/prompts.ts src/lib/eval/prompts.test.ts
rm -rf src/lib/eval/__snapshots__
rm src/lib/eval/seed-data.ts
rm src/lib/eval/store.ts src/lib/eval/store.test.ts
rm src/ai/eval/run-strategy.ts src/ai/eval/run-strategy.test.ts
```

- [ ] **Step 2: Replace `src/app/eval/page.tsx` with the stub**

```tsx
'use client';

export default function EvalPage() {
  return (
    <div className="max-w-6xl mx-auto p-6 pt-20 min-h-screen">
      <header className="mb-8">
        <h1 className="text-3xl font-black text-white">Find-Matches Eval v2</h1>
        <p className="text-white/60">Under construction. The v2 rebuild is in progress.</p>
      </header>
    </div>
  );
}
```

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: 0 errors. (No files reference the deleted modules anymore because page.tsx no longer imports them and openrouter-client.ts doesn't import any of them either.)

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: 0 test files found. Vitest exits with a "no test files" message. This is fine — we're rebuilding.

- [ ] **Step 5: Commit**

```bash
git add -A src/lib/eval src/ai/eval src/app/eval
git commit -m "$(cat <<'EOF'
refactor(eval): clean slate for v2 rewrite

Deletes v1 eval logic (types, metrics, prompts, seed data, store,
run-strategy + tests + snapshots) and stubs page.tsx. Keeps the
OpenRouter client since it's unchanged in v2.

After this commit typecheck passes, tests pass (none exist),
and /eval shows an under-construction stub. Phase B (Tasks 2-9)
will rebuild the logic layer bottom-up.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Types + shared errors

**Files:**
- Create: `src/lib/eval/types.ts`

No tests — types-only file.

- [ ] **Step 1: Create `src/lib/eval/types.ts`**

```ts
// Shared types for the eval framework v2.
// Pairwise compatibility: each EvalRow is two text profiles + a ground-truth score.

// ---------- Core data ----------

export interface EvalRow {
  id: string;
  label: string;
  profileA: string;
  profileB: string;
  expected: {
    score: number;      // 0-100
    reasoning: string;
  };
  tags: string[];
}

// ---------- Strategy (a model + prompt variant + optional internal run count) ----------

export type PromptVariant = 'default' | 'simplified';

export interface Strategy {
  id: string;
  name: string;
  model: string;              // OpenRouter model ID, e.g. "google/gemini-2.5-flash"
  promptVariant: PromptVariant;
  // How many internal LLM calls the strategy's algorithm makes (median-of-N, deferred to v2.1).
  // NOT the same as sweep-level repeat runs, which live in SweepConfig.
  runCount: number;
}

// ---------- What a strategy returns ----------

export interface StrategyOutput {
  score: number;      // 0-100
  reasoning: string;
}

// ---------- Run result (one invocation of a strategy on a row) ----------

export interface RunResult {
  id: string;
  strategyId: string;
  rowId: string;
  runIndex: number;             // 0..repeatCount-1 for sweep-level repeats; 0 when repeatCount=1
  timestamp: string;            // ISO 8601 — lexicographically sortable without Date parsing
  output: StrategyOutput | null;
  rawOutput?: string;           // raw LLM string; useful when parsing fails
  metrics: RunMetrics | null;
  error?: string;
}

// ---------- Metrics for ONE run ----------

export interface RunMetrics {
  scoreDelta: number;                  // abs(output.score - expected.score)
  reasoningLength: number;             // trimmed char count
  hasSubstantiveReasoning: boolean;    // reasoningLength >= SUBSTANTIVE_REASONING_MIN
  costUsd: number | null;              // null if model not in price table
  latencyMs: number;
}

// ---------- Aggregated metrics across N runs (sweep-level repeats) ----------

export interface AggregatedMetrics {
  avgScoreDelta: number;
  scoreStdDev: number;                 // population stddev of raw scores. 0 when runCount==1.
  avgReasoningLength: number;
  substantiveReasoningRate: number;    // fraction of runs with hasSubstantiveReasoning === true
  avgCostUsd: number | null;
  avgLatencyMs: number;
  runCount: number;
}

// ---------- Sweep config (what the Run tab builds) ----------

export interface SweepConfig {
  selectedRowIds: string[];
  selectedStrategyIds: string[];
  repeatCount: number;                 // 1 = no repetition
  tagFilter?: string[];                // rows must have at least one of these tags; undefined = no filter
}

// ---------- Typed errors ----------

export class MetricsInvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MetricsInvariantError';
  }
}

export class EvalConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EvalConfigError';
  }
}

export class EvalStorageFullError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EvalStorageFullError';
  }
}
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/eval/types.ts
git commit -m "$(cat <<'EOF'
feat(eval v2): add shared types for pairwise compatibility model

EvalRow (two text profiles + expected score), Strategy (model +
promptVariant + runCount), RunResult/RunMetrics/AggregatedMetrics
(with scoreStdDev for repeat-run reliability), SweepConfig, typed
errors. These are the contract for the v2 rebuild.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Model prices + token estimator

**Files:**
- Create: `src/lib/eval/model-prices.ts`

No tests — pure data + one trivial helper.

- [ ] **Step 1: Create `src/lib/eval/model-prices.ts`**

```ts
// USD per 1M tokens + context window in tokens.
// Values are approximate — used for pre-run cost preview and context-window overflow checks.
// Verify against https://openrouter.ai/models at implementation time and update if stale.

export interface ModelPrice {
  inputPerM: number;
  outputPerM: number;
  contextWindow: number;   // total tokens (input + output)
}

export const modelPrices: Record<string, ModelPrice> = {
  'google/gemini-2.5-flash':        { inputPerM: 0.075, outputPerM: 0.30, contextWindow: 1_000_000 },
  'anthropic/claude-sonnet-4':      { inputPerM: 3.0,   outputPerM: 15.0, contextWindow: 200_000 },
  'openai/gpt-4o-mini':             { inputPerM: 0.15,  outputPerM: 0.60, contextWindow: 128_000 },
  'meta-llama/llama-3-8b-instruct': { inputPerM: 0.05,  outputPerM: 0.08, contextWindow: 8_192 },
};

// Cost in USD for a single call given measured token usage. Null if model unknown.
export function calculateCost(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number | null {
  const price = modelPrices[model];
  if (!price) return null;
  return (promptTokens * price.inputPerM + completionTokens * price.outputPerM) / 1_000_000;
}

// Rough pre-run token estimate. GPT tokenizer averages ~4 chars per token for English.
// Used by plan-sweep.ts for context-window overflow checks and cost preview.
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/eval/model-prices.ts
git commit -m "$(cat <<'EOF'
feat(eval v2): add model prices + contextWindow + token estimator

Price table now includes contextWindow for the pre-run overflow
check. New estimateTokens helper uses a ~4-chars-per-token heuristic
for cost/overflow previews.

Fixes the Sonnet model ID bug: uses anthropic/claude-sonnet-4
instead of the deprecated anthropic/claude-3.5-sonnet which returned
404 on OpenRouter.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Plan-sweep (TDD)

Pure function that takes `{rows, strategies, repeatCount}` and returns a `SweepPlan` with `runnable[]` (what to actually run), `skipped[]` (context-window overflows), and cost/time estimates.

**Files:**
- Create: `src/lib/eval/plan-sweep.test.ts` (write FIRST)
- Create: `src/lib/eval/plan-sweep.ts` (write AFTER)

- [ ] **Step 1: Write the failing test file**

Create `src/lib/eval/plan-sweep.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { planSweep } from './plan-sweep';
import type { EvalRow, Strategy } from './types';

function makeRow(id: string, profileALen: number = 100, profileBLen: number = 100): EvalRow {
  return {
    id,
    label: `row ${id}`,
    profileA: 'a'.repeat(profileALen),
    profileB: 'b'.repeat(profileBLen),
    expected: { score: 50, reasoning: 'test' },
    tags: [],
  };
}

function makeStrategy(id: string, model: string): Strategy {
  return {
    id,
    name: id,
    model,
    promptVariant: 'default',
    runCount: 1,
  };
}

describe('planSweep', () => {
  it('returns empty plan for empty inputs', () => {
    const plan = planSweep([], [], 1);
    expect(plan.runnable).toHaveLength(0);
    expect(plan.skipped).toHaveLength(0);
    expect(plan.runCount).toBe(0);
    expect(plan.estimatedUsd).toBe(0);
  });

  it('generates one runnable per row x strategy when nothing overflows', () => {
    const rows = [makeRow('r1'), makeRow('r2')];
    const strategies = [
      makeStrategy('s1', 'google/gemini-2.5-flash'),
      makeStrategy('s2', 'openai/gpt-4o-mini'),
    ];
    const plan = planSweep(rows, strategies, 1);
    expect(plan.runnable).toHaveLength(4); // 2 rows x 2 strategies x 1 repeat
    expect(plan.skipped).toHaveLength(0);
    expect(plan.runCount).toBe(4);
  });

  it('multiplies runnable count by repeatCount', () => {
    const rows = [makeRow('r1')];
    const strategies = [makeStrategy('s1', 'google/gemini-2.5-flash')];
    const plan = planSweep(rows, strategies, 3);
    expect(plan.runnable).toHaveLength(3);
    // runIndex should be 0, 1, 2
    expect(plan.runnable.map(r => r.runIndex).sort()).toEqual([0, 1, 2]);
  });

  it('skips combinations that would overflow the model context window', () => {
    // Llama 3 8B has 8192 context window. Make a huge profile.
    const rows = [makeRow('r1', 50_000, 50_000)]; // ~25k estimated tokens
    const strategies = [makeStrategy('s1', 'meta-llama/llama-3-8b-instruct')];
    const plan = planSweep(rows, strategies, 1);
    expect(plan.runnable).toHaveLength(0);
    expect(plan.skipped).toHaveLength(1);
    expect(plan.skipped[0].rowId).toBe('r1');
    expect(plan.skipped[0].strategyId).toBe('s1');
    expect(plan.skipped[0].contextWindow).toBe(8192);
  });

  it('partially skips: overflow for one strategy, runs for another', () => {
    const rows = [makeRow('r1', 50_000, 50_000)];
    const strategies = [
      makeStrategy('s-small', 'meta-llama/llama-3-8b-instruct'),
      makeStrategy('s-large', 'google/gemini-2.5-flash'),
    ];
    const plan = planSweep(rows, strategies, 1);
    expect(plan.runnable).toHaveLength(1);
    expect(plan.runnable[0].strategy.id).toBe('s-large');
    expect(plan.skipped).toHaveLength(1);
    expect(plan.skipped[0].strategyId).toBe('s-small');
  });

  it('counts unknown models in unknownModelCount', () => {
    const rows = [makeRow('r1')];
    const strategies = [makeStrategy('s1', 'some/unknown-model')];
    const plan = planSweep(rows, strategies, 1);
    // Unknown model is treated as runnable (we can't overflow-check it) but counted separately.
    expect(plan.runnable).toHaveLength(1);
    expect(plan.unknownModelCount).toBe(1);
    expect(plan.estimatedUsd).toBe(0); // unknown models contribute 0 to the estimate
  });

  it('estimates time as runnable.length * 2 seconds', () => {
    const rows = [makeRow('r1'), makeRow('r2')];
    const strategies = [makeStrategy('s1', 'google/gemini-2.5-flash')];
    const plan = planSweep(rows, strategies, 3);
    expect(plan.runnable).toHaveLength(6); // 2 * 1 * 3
    expect(plan.estimatedSeconds).toBe(12);
  });

  it('estimates cost using token heuristic', () => {
    // One small row, one strategy, one run. gemini flash: 0.075 in, 0.30 out per 1M.
    // Profile A+B each 100 chars = 200 chars. Plus prompt boilerplate ~600 chars.
    // Total ~800 chars / 4 = ~200 input tokens. +500 output = ~0.075*200 + 0.30*500 = 15 + 150 = 165 per million = 0.000165 USD.
    const rows = [makeRow('r1', 100, 100)];
    const strategies = [makeStrategy('s1', 'google/gemini-2.5-flash')];
    const plan = planSweep(rows, strategies, 1);
    expect(plan.runnable).toHaveLength(1);
    expect(plan.estimatedUsd).toBeGreaterThan(0);
    expect(plan.estimatedUsd).toBeLessThan(0.01); // sanity check: not hundreds of dollars
  });
});
```

- [ ] **Step 2: Run tests — verify they all fail**

Run: `npm test -- plan-sweep`
Expected: All tests fail with "Cannot find module './plan-sweep'".

- [ ] **Step 3: Implement `src/lib/eval/plan-sweep.ts`**

```ts
import type { EvalRow, Strategy } from './types';
import { modelPrices, estimateTokens } from './model-prices';

// Reserve for the model's output (scoreJSON is short but keep safety margin).
const COMPLETION_TOKEN_RESERVE = 500;

export interface OverflowWarning {
  rowId: string;
  strategyId: string;
  estimatedTokens: number;
  contextWindow: number;
}

export interface SweepPlanItem {
  row: EvalRow;
  strategy: Strategy;
  runIndex: number;
}

export interface SweepPlan {
  runnable: SweepPlanItem[];
  skipped: OverflowWarning[];
  estimatedUsd: number;
  unknownModelCount: number;
  estimatedSeconds: number;
  runCount: number;
}

// Pure function: no I/O, deterministic.
// Skips combinations whose estimated input tokens + completion reserve exceed the model's context window.
// Unknown models (not in price table) are treated as runnable but counted in unknownModelCount.
export function planSweep(
  rows: EvalRow[],
  strategies: Strategy[],
  repeatCount: number,
): SweepPlan {
  const runnable: SweepPlanItem[] = [];
  const skipped: OverflowWarning[] = [];
  let estimatedUsd = 0;
  let unknownModelCount = 0;

  for (const row of rows) {
    for (const strategy of strategies) {
      // Estimate input tokens from the rendered profile content + prompt boilerplate.
      // We approximate the boilerplate at 600 chars for the default variant.
      const boilerplateChars = strategy.promptVariant === 'simplified' ? 100 : 600;
      const estimatedInputTokens =
        estimateTokens(row.profileA) +
        estimateTokens(row.profileB) +
        estimateTokens('x'.repeat(boilerplateChars));

      const totalEstimatedTokens = estimatedInputTokens + COMPLETION_TOKEN_RESERVE;
      const priceEntry = modelPrices[strategy.model];

      if (priceEntry && totalEstimatedTokens > priceEntry.contextWindow) {
        // Overflow: skip all repeatCount copies of this combination.
        skipped.push({
          rowId: row.id,
          strategyId: strategy.id,
          estimatedTokens: totalEstimatedTokens,
          contextWindow: priceEntry.contextWindow,
        });
        continue;
      }

      if (!priceEntry) {
        unknownModelCount++;
      }

      // Add repeatCount copies with runIndex 0..repeatCount-1.
      for (let i = 0; i < repeatCount; i++) {
        runnable.push({ row, strategy, runIndex: i });
      }

      // Cost estimate (per repeat) — only counted if model is known.
      if (priceEntry) {
        const perCall =
          (estimatedInputTokens * priceEntry.inputPerM +
            COMPLETION_TOKEN_RESERVE * priceEntry.outputPerM) /
          1_000_000;
        estimatedUsd += perCall * repeatCount;
      }
    }
  }

  return {
    runnable,
    skipped,
    estimatedUsd,
    unknownModelCount,
    estimatedSeconds: runnable.length * 2,
    runCount: runnable.length,
  };
}
```

- [ ] **Step 4: Run tests — all should pass**

Run: `npm test -- plan-sweep`
Expected: All 8 tests pass.

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/eval/plan-sweep.ts src/lib/eval/plan-sweep.test.ts
git commit -m "$(cat <<'EOF'
feat(eval v2): add plan-sweep pure function

planSweep takes rows + strategies + repeatCount and returns a
SweepPlan with runnable[] (safe to run) and skipped[] (context
window overflow). Used by the Run tab for pre-flight cost + overflow
preview before the sweep starts.

TDD: 8 tests written first (empty inputs, no-overflow happy path,
repeatCount multiplier, full/partial overflow, unknown model,
time + cost estimates).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Metrics (TDD)

**Files:**
- Create: `src/lib/eval/metrics.test.ts` (write FIRST)
- Create: `src/lib/eval/metrics.ts` (write AFTER)

- [ ] **Step 1: Write the failing test file**

Create `src/lib/eval/metrics.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests — verify they fail**

Run: `npm test -- metrics`
Expected: Tests fail with "Cannot find module './metrics'".

- [ ] **Step 3: Implement `src/lib/eval/metrics.ts`**

```ts
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
```

- [ ] **Step 4: Run tests — all should pass**

Run: `npm test -- metrics`
Expected: All 14 tests pass (8 scoreRunResult + 6 aggregateMetrics).

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/eval/metrics.ts src/lib/eval/metrics.test.ts
git commit -m "$(cat <<'EOF'
feat(eval v2): add scoreRunResult + aggregateMetrics

scoreRunResult validates one StrategyOutput against expected ground
truth and returns scoreDelta + reasoningLength + hasSubstantiveReasoning.
Throws MetricsInvariantError on out-of-range scores or empty reasoning.

aggregateMetrics handles repeat runs: returns avgScoreDelta + population
scoreStdDev (reliability signal) + substantiveReasoningRate + cost/latency
averages. scoreStdDev is 0 for a single run.

SUBSTANTIVE_REASONING_MIN = 50 chars is the v2 threshold for flagging
low-effort LLM outputs.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Prompts (TDD with snapshots)

**Files:**
- Create: `src/lib/eval/prompts.ts`
- Create: `src/lib/eval/prompts.test.ts`

- [ ] **Step 1: Create `src/lib/eval/prompts.ts`**

```ts
import type { EvalRow, PromptVariant } from './types';

export interface PromptInput {
  profileA: string;
  profileB: string;
}

// Helper: build a PromptInput from an EvalRow (drops unrelated fields).
export function promptInputFromRow(row: EvalRow): PromptInput {
  return { profileA: row.profileA, profileB: row.profileB };
}

// Registry: variant name → function that produces the full prompt string.
export const promptVariants: Record<PromptVariant, (input: PromptInput) => string> = {
  default: buildDefaultPrompt,
  simplified: buildSimplifiedPrompt,
};

function buildDefaultPrompt({ profileA, profileB }: PromptInput): string {
  return `You are an expert relationship psychologist.

Given two profiles, score their compatibility from 0 (zero chance this works) to 100 (perfect match).
Consider values, lifestyle, emotional availability, and long-term potential.

Profile A:
${profileA}

Profile B:
${profileB}

Return STRICT JSON with no markdown:
{
  "score": <integer 0-100>,
  "reasoning": "<2-4 sentences explaining the score>"
}`;
}

function buildSimplifiedPrompt({ profileA, profileB }: PromptInput): string {
  return `Score 0-100 how compatible these two people are.

A: ${profileA}
B: ${profileB}

JSON: {"score": N, "reasoning": "text"}`;
}
```

- [ ] **Step 2: Create `src/lib/eval/prompts.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { promptVariants, promptInputFromRow, type PromptInput } from './prompts';
import type { EvalRow } from './types';

const fixture: PromptInput = {
  profileA: 'Alex, 28. Quiet writer and climber. Secure attachment. Values depth.',
  profileB: 'Sam, 29. Warm therapist, emotionally present. Secure attachment.',
};

describe('promptVariants', () => {
  it('default variant matches snapshot', () => {
    const rendered = promptVariants.default(fixture);
    expect(rendered).toMatchSnapshot();
  });

  it('default variant includes both profiles', () => {
    const rendered = promptVariants.default(fixture);
    expect(rendered).toContain('Alex, 28');
    expect(rendered).toContain('Sam, 29');
  });

  it('default variant includes the JSON schema instruction', () => {
    const rendered = promptVariants.default(fixture);
    expect(rendered).toContain('Return STRICT JSON');
    expect(rendered).toContain('"score":');
    expect(rendered).toContain('"reasoning":');
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

describe('promptInputFromRow', () => {
  it('extracts profileA and profileB from an EvalRow', () => {
    const row: EvalRow = {
      id: 'r1',
      label: 'test',
      profileA: 'A text',
      profileB: 'B text',
      expected: { score: 50, reasoning: 'test' },
      tags: [],
    };
    const input = promptInputFromRow(row);
    expect(input).toEqual({ profileA: 'A text', profileB: 'B text' });
  });
});
```

- [ ] **Step 3: Run tests — snapshots create on first run**

Run: `npm test -- prompts`
Expected: All 6 tests pass. Snapshot file auto-generated at `src/lib/eval/__snapshots__/prompts.test.ts.snap`.

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/eval/prompts.ts src/lib/eval/prompts.test.ts src/lib/eval/__snapshots__/
git commit -m "$(cat <<'EOF'
feat(eval v2): add pairwise compatibility prompts + snapshot tests

Two variants: 'default' (structured instructions, rubric reminders,
JSON schema) and 'simplified' (minimal, for baseline comparison).
Both take a PromptInput { profileA, profileB } and return a string.

Snapshot tests catch accidental drift. promptInputFromRow helper
extracts the pairwise content from an EvalRow.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Seed data

**Files:**
- Create: `src/lib/eval/seed-data.ts`

No tests — pure data.

- [ ] **Step 1: Create `src/lib/eval/seed-data.ts`**

```ts
import type { EvalRow, Strategy } from './types';

// 4 hardcoded test rows, each exercising a different compatibility pattern.
// Expected scores are placeholder starting values — relabel from the /eval UI.
export const seedRows: EvalRow[] = [
  {
    id: 'r1-high-match',
    label: 'High match: aligned introverts',
    profileA:
      'Alex, 28. Quiet writer and climber. Values deep conversation over small talk. Looking for someone who reads books and wants to build a calm, stable life together. Secure attachment style.',
    profileB:
      'Sam, 29. Therapist. Warm and emotionally present. Enjoys slow mornings, hiking, and long honest talks. Looking for a creative, introspective partner who values emotional attunement. Secure attachment.',
    expected: {
      score: 90,
      reasoning:
        'Both secure, aligned core values (depth, calm, creativity), mutual fit on lifestyle and attachment style.',
    },
    tags: ['high-match', 'secure-secure', 'aligned'],
  },

  {
    id: 'r2-deal-breaker',
    label: 'Deal-breaker: anxious + avoidant',
    profileA:
      'Jordan, 26. Affectionate and needs reassurance. Gets anxious when partners go silent for more than a day. Looking for someone warm, consistent, and emotionally available.',
    profileB:
      'Riley, 30. Values independence above all. Slow to open up, needs lots of alone time, uncomfortable with frequent check-ins. Looking for someone who respects space.',
    expected: {
      score: 10,
      reasoning:
        'Classic anxious + avoidant pairing. Jordan needs the reassurance Riley is wired to withhold, creating a predictable cycle of frustration.',
    },
    tags: ['deal-breaker', 'anxious-avoidant', 'attachment-mismatch'],
  },

  {
    id: 'r3-medium',
    label: 'Medium match: partial overlap',
    profileA:
      'Taylor, 31. Outdoorsy, spontaneous, loves art and music festivals. Looking for an adventurous partner who is also grounded and calm.',
    profileB:
      'Morgan, 29. Enjoys hiking and climbing on weekends but also needs significant quiet time. Introverted; recharges alone. Looking for someone spontaneous who also appreciates downtime.',
    expected: {
      score: 65,
      reasoning:
        'Shared adventure tag and lifestyle compatibility, but Taylor wants high-energy social fun while Morgan needs quiet recharge — possible friction around pace.',
    },
    tags: ['medium-match', 'partial-overlap'],
  },

  {
    id: 'r4-asymmetric',
    label: 'Asymmetric: one-sided attraction',
    profileA:
      'Avery, 27. Loud, impulsive party lover. Looking for a calm, grounded intellectual to balance their energy.',
    profileB:
      'Quinn, 30. Calm, grounded intellectual. Dislikes loud environments and social chaos. Looking for a quiet, introspective partner.',
    expected: {
      score: 35,
      reasoning:
        'Avery would find Quinn fulfilling, but Quinn would find Avery exhausting. One-sided compatibility lowers the overall score.',
    },
    tags: ['asymmetric', 'reciprocity-test'],
  },
];

// 4 default strategies seeded on first load. All models are keys in modelPrices.
// Sonnet fix: 'claude-sonnet-4' replaces the deprecated 'claude-3.5-sonnet' from v1.
export const seedStrategies: Strategy[] = [
  {
    id: 'gemini-flash-default',
    name: 'Gemini 2.5 Flash (default)',
    model: 'google/gemini-2.5-flash',
    promptVariant: 'default',
    runCount: 1,
  },
  {
    id: 'claude-sonnet-4',
    name: 'Claude Sonnet 4 (default)',
    model: 'anthropic/claude-sonnet-4',
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
feat(eval v2): add seed data (4 rows + 4 strategies)

Four pairwise test rows: high match (aligned secure), deal-breaker
(anxious + avoidant), medium (partial overlap), asymmetric (one-sided
attraction). Each exercises a different compatibility pattern so the
eval framework surfaces different failure modes across models.

Four seeded strategies; Sonnet ID updated to anthropic/claude-sonnet-4
(v1's claude-3.5-sonnet returns 404 on OpenRouter).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Store (TDD)

**Files:**
- Create: `src/lib/eval/store.test.ts` (write FIRST)
- Create: `src/lib/eval/store.ts` (write AFTER)

- [ ] **Step 1: Write the failing test file**

Create `src/lib/eval/store.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { LocalStorageEvalStore } from './store';
import type { EvalRow, Strategy, RunResult } from './types';

function sampleRow(id: string): EvalRow {
  return {
    id,
    label: `row ${id}`,
    profileA: 'A content',
    profileB: 'B content',
    expected: { score: 70, reasoning: 'test' },
    tags: ['test-tag'],
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

function sampleResult(id: string, strategyId: string, rowId: string): RunResult {
  return {
    id,
    strategyId,
    rowId,
    runIndex: 0,
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

  it('round-trips a saved row', async () => {
    const store = new LocalStorageEvalStore({ skipSeeding: true });
    await store.saveRow(sampleRow('r1'));
    const rows = await store.getRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe('r1');
  });

  it('deletes a row by id', async () => {
    const store = new LocalStorageEvalStore({ skipSeeding: true });
    await store.saveRow(sampleRow('r1'));
    await store.saveRow(sampleRow('r2'));
    await store.deleteRow('r1');
    const rows = await store.getRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe('r2');
  });

  it('seeds v2 defaults on first access when seeding is enabled', async () => {
    const store = new LocalStorageEvalStore();
    const rows = await store.getRows();
    const strategies = await store.getStrategies();
    expect(rows.length).toBeGreaterThan(0);
    expect(strategies.length).toBeGreaterThan(0);
    // Must include the Sonnet fix
    expect(strategies.some(s => s.id === 'claude-sonnet-4')).toBe(true);
    // Must NOT include the v1 broken ID
    expect(strategies.some(s => s.id === 'claude-sonnet-default')).toBe(false);
  });

  it('does not re-seed if data already exists', async () => {
    const store1 = new LocalStorageEvalStore({ skipSeeding: true });
    await store1.saveRow(sampleRow('only-one'));

    const store2 = new LocalStorageEvalStore();
    const rows = await store2.getRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe('only-one');
  });

  it('cascade deletes results when a row is deleted', async () => {
    const store = new LocalStorageEvalStore({ skipSeeding: true });
    await store.saveRow(sampleRow('r1'));
    await store.saveRow(sampleRow('r2'));
    await store.saveResult(sampleResult('res1', 's1', 'r1'));
    await store.saveResult(sampleResult('res2', 's1', 'r2'));
    await store.saveResult(sampleResult('res3', 's2', 'r1'));

    await store.deleteResultsForRow('r1');
    const results = await store.getResults();
    expect(results).toHaveLength(1);
    expect(results[0].rowId).toBe('r2');
  });

  it('cascade deletes results when a strategy is deleted', async () => {
    const store = new LocalStorageEvalStore({ skipSeeding: true });
    await store.saveResult(sampleResult('res1', 's1', 'r1'));
    await store.saveResult(sampleResult('res2', 's2', 'r1'));
    await store.saveResult(sampleResult('res3', 's1', 'r2'));

    await store.deleteResultsForStrategy('s1');
    const results = await store.getResults();
    expect(results).toHaveLength(1);
    expect(results[0].strategyId).toBe('s2');
  });

  it('clears all results', async () => {
    const store = new LocalStorageEvalStore({ skipSeeding: true });
    await store.saveResult(sampleResult('res1', 's1', 'r1'));
    await store.saveResult(sampleResult('res2', 's1', 'r2'));
    await store.clearResults();
    const results = await store.getResults();
    expect(results).toHaveLength(0);
  });

  it('detects v1 localStorage and wipes + re-seeds', async () => {
    // Simulate v1 data: eval.pairs key with objects containing v1-specific fields.
    localStorage.setItem(
      'eval.pairs',
      JSON.stringify([{ id: 'p1', candidates: [{ id: 'c1' }], expected: [{ candidateId: 'c1', expectedFinalScore: 80 }] }]),
    );
    localStorage.setItem(
      'eval.strategies',
      JSON.stringify([{ id: 'old-strategy', model: 'anthropic/claude-3.5-sonnet' }]),
    );

    const store = new LocalStorageEvalStore();
    const rows = await store.getRows();

    // v1 wiped + v2 seeded. New data is present, old key is gone.
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]).toHaveProperty('profileA');
    expect(rows[0]).not.toHaveProperty('candidates');
    expect(localStorage.getItem('eval.pairs')).toBeNull();

    // Wipe flag is set so subsequent getV1WipeNotice returns true once.
    expect(store.consumeV1WipeNotice()).toBe(true);
    expect(store.consumeV1WipeNotice()).toBe(false); // only fires once
  });

  it('returns empty arrays under SSR (window undefined)', async () => {
    const originalWindow = globalThis.window;
    // @ts-expect-error simulate SSR
    delete globalThis.window;

    const store = new LocalStorageEvalStore({ skipSeeding: true });
    expect(await store.getRows()).toEqual([]);
    expect(await store.getStrategies()).toEqual([]);
    expect(await store.getResults()).toEqual([]);

    globalThis.window = originalWindow;
  });
});
```

- [ ] **Step 2: Run tests — verify failure**

Run: `npm test -- store`
Expected: Tests fail with "Cannot find module './store'".

- [ ] **Step 3: Implement `src/lib/eval/store.ts`**

```ts
import {
  EvalStorageFullError,
  type EvalRow,
  type Strategy,
  type RunResult,
} from './types';
import { seedRows, seedStrategies } from './seed-data';

export interface EvalStore {
  getRows(): Promise<EvalRow[]>;
  saveRow(row: EvalRow): Promise<void>;
  deleteRow(id: string): Promise<void>;

  getStrategies(): Promise<Strategy[]>;
  saveStrategy(s: Strategy): Promise<void>;
  deleteStrategy(id: string): Promise<void>;

  getResults(): Promise<RunResult[]>;
  saveResult(r: RunResult): Promise<void>;
  deleteResultsForRow(rowId: string): Promise<void>;
  deleteResultsForStrategy(strategyId: string): Promise<void>;
  clearResults(): Promise<void>;
}

const KEYS = {
  rows: 'eval.rows',
  strategies: 'eval.strategies',
  results: 'eval.results',
  // v1 legacy key — checked at startup for migration detection
  v1Pairs: 'eval.pairs',
} as const;

interface StoreOptions {
  skipSeeding?: boolean;
}

export class LocalStorageEvalStore implements EvalStore {
  private seeded = false;
  private v1WipeOccurred = false;
  constructor(private readonly options: StoreOptions = {}) {}

  // --- Rows ---

  async getRows(): Promise<EvalRow[]> {
    if (!this.isBrowser()) return [];
    this.seedIfNeeded();
    return this.read<EvalRow[]>(KEYS.rows, []);
  }

  async saveRow(row: EvalRow): Promise<void> {
    if (!this.isBrowser()) return;
    this.seedIfNeeded();
    const rows = this.read<EvalRow[]>(KEYS.rows, []);
    const idx = rows.findIndex(r => r.id === row.id);
    if (idx >= 0) rows[idx] = row;
    else rows.push(row);
    this.write(KEYS.rows, rows);
  }

  async deleteRow(id: string): Promise<void> {
    if (!this.isBrowser()) return;
    const rows = this.read<EvalRow[]>(KEYS.rows, []);
    this.write(KEYS.rows, rows.filter(r => r.id !== id));
  }

  // --- Strategies ---

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

  // --- Results ---

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

  async deleteResultsForRow(rowId: string): Promise<void> {
    if (!this.isBrowser()) return;
    const results = this.read<RunResult[]>(KEYS.results, []);
    this.write(KEYS.results, results.filter(r => r.rowId !== rowId));
  }

  async deleteResultsForStrategy(strategyId: string): Promise<void> {
    if (!this.isBrowser()) return;
    const results = this.read<RunResult[]>(KEYS.results, []);
    this.write(KEYS.results, results.filter(r => r.strategyId !== strategyId));
  }

  async clearResults(): Promise<void> {
    if (!this.isBrowser()) return;
    this.write(KEYS.results, []);
  }

  // --- v1 migration notice (read-once flag consumed by the UI) ---

  consumeV1WipeNotice(): boolean {
    const val = this.v1WipeOccurred;
    this.v1WipeOccurred = false;
    return val;
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

    // 1. Detect v1 data (by presence of the old eval.pairs key OR by v1-shaped strategies).
    const v1Detected = this.detectV1Data();
    if (v1Detected) {
      // Wipe all eval.* keys — a clean slate for v2.
      window.localStorage.removeItem(KEYS.v1Pairs);
      window.localStorage.removeItem(KEYS.rows);
      window.localStorage.removeItem(KEYS.strategies);
      window.localStorage.removeItem(KEYS.results);
      this.v1WipeOccurred = true;
    }

    // 2. Seed defaults if the v2 keys are missing.
    if (!window.localStorage.getItem(KEYS.rows)) {
      this.write(KEYS.rows, seedRows);
    }
    if (!window.localStorage.getItem(KEYS.strategies)) {
      this.write(KEYS.strategies, seedStrategies);
    }
  }

  private detectV1Data(): boolean {
    // v1 stored rows under eval.pairs — its mere presence is a strong signal.
    if (window.localStorage.getItem(KEYS.v1Pairs) != null) return true;

    // Also check stored strategies for v1-shaped entries (e.g. claude-3.5-sonnet).
    try {
      const rawStrategies = window.localStorage.getItem(KEYS.strategies);
      if (rawStrategies) {
        const parsed = JSON.parse(rawStrategies) as unknown;
        if (Array.isArray(parsed)) {
          for (const s of parsed as Array<Record<string, unknown>>) {
            if (s?.model === 'anthropic/claude-3.5-sonnet') return true;
          }
        }
      }
    } catch {
      // corrupt or missing; fall through
    }

    return false;
  }
}
```

- [ ] **Step 4: Run tests — all should pass**

Run: `npm test -- store`
Expected: All 9 tests pass.

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/eval/store.ts src/lib/eval/store.test.ts
git commit -m "$(cat <<'EOF'
feat(eval v2): add LocalStorageEvalStore with v1 migration + cascade delete

New methods: getRows/saveRow/deleteRow (rename from v1's pair methods),
deleteResultsForRow, deleteResultsForStrategy (cascade deletes).

v1 detection: on first access, if eval.pairs exists OR a strategy uses
anthropic/claude-3.5-sonnet, wipe all eval.* keys and re-seed with v2
defaults. consumeV1WipeNotice() returns true once so the UI can show a
toast notification.

SSR-safe guards retained from v1. TDD: 9 tests cover CRUD, seeding,
cascade, and v1 migration.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Run-strategy (TDD with mocked OpenRouter)

**Files:**
- Create: `src/ai/eval/run-strategy.test.ts` (write FIRST)
- Create: `src/ai/eval/run-strategy.ts` (write AFTER)

- [ ] **Step 1: Write the failing test file**

Create `src/ai/eval/run-strategy.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Strategy, EvalRow } from '@/lib/eval/types';

// Mock openrouter-client + server-only before importing run-strategy.
vi.mock('./openrouter-client', () => ({ callOpenRouter: vi.fn() }));
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

const row: EvalRow = {
  id: 'r-test',
  label: 'test',
  profileA: 'Alex, warm and curious',
  profileB: 'Sam, calm and grounded',
  expected: { score: 80, reasoning: 'good fit' },
  tags: [],
};

describe('runStrategy', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('happy path: valid output returns RunResult with metrics', async () => {
    vi.mocked(callOpenRouter).mockResolvedValue({
      content: JSON.stringify({
        score: 80,
        reasoning: 'Both warm and emotionally available, complementary styles, strong long-term potential match.',
      }),
      promptTokens: 200,
      completionTokens: 100,
    });

    const result = await runStrategy(strategy, row);

    expect(result.error).toBeUndefined();
    expect(result.output?.score).toBe(80);
    expect(result.metrics).not.toBeNull();
    expect(result.metrics!.scoreDelta).toBe(0);
    expect(result.metrics!.hasSubstantiveReasoning).toBe(true);
    expect(result.metrics!.costUsd).not.toBeNull();
    expect(result.metrics!.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.runIndex).toBe(0);
    expect(result.rowId).toBe('r-test');
    expect(result.strategyId).toBe('s-test');
  });

  it('stamps runIndex from the caller', async () => {
    vi.mocked(callOpenRouter).mockResolvedValue({
      content: JSON.stringify({ score: 80, reasoning: 'valid long reasoning that is more than fifty chars long enough' }),
      promptTokens: 100,
      completionTokens: 50,
    });
    const result = await runStrategy(strategy, row, 5);
    expect(result.runIndex).toBe(5);
  });

  it('malformed JSON → error + rawOutput preserved', async () => {
    vi.mocked(callOpenRouter).mockResolvedValue({
      content: 'not JSON {oops',
      promptTokens: 50,
      completionTokens: 5,
    });
    const result = await runStrategy(strategy, row);
    expect(result.error).toMatch(/parse|JSON/i);
    expect(result.rawOutput).toBe('not JSON {oops');
    expect(result.metrics).toBeNull();
  });

  it('strips ```json fences from LLM output before parsing', async () => {
    vi.mocked(callOpenRouter).mockResolvedValue({
      content: '```json\n{"score": 75, "reasoning": "reasoning long enough to pass the fifty char threshold easily here"}\n```',
      promptTokens: 100,
      completionTokens: 50,
    });
    const result = await runStrategy(strategy, row);
    expect(result.error).toBeUndefined();
    expect(result.output?.score).toBe(75);
  });

  it('empty content → empty-content error', async () => {
    vi.mocked(callOpenRouter).mockResolvedValue({ content: '', promptTokens: 50, completionTokens: 0 });
    const result = await runStrategy(strategy, row);
    expect(result.error).toMatch(/empty/i);
    expect(result.metrics).toBeNull();
  });

  it('OpenRouter throws → error captured, no crash', async () => {
    vi.mocked(callOpenRouter).mockRejectedValue(new Error('OpenRouter 429: rate limited'));
    const result = await runStrategy(strategy, row);
    expect(result.error).toMatch(/rate limited/);
    expect(result.metrics).toBeNull();
  });

  it('score out of range → MetricsInvariantError captured', async () => {
    vi.mocked(callOpenRouter).mockResolvedValue({
      content: JSON.stringify({ score: 150, reasoning: 'valid long reasoning that is more than fifty characters long enough' }),
      promptTokens: 100,
      completionTokens: 50,
    });
    const result = await runStrategy(strategy, row);
    expect(result.error).toMatch(/score|range|0.*100/i);
    expect(result.output).not.toBeNull();  // parsed ok; metrics failed
    expect(result.metrics).toBeNull();
  });

  it('cost calculation matches token usage', async () => {
    vi.mocked(callOpenRouter).mockResolvedValue({
      content: JSON.stringify({ score: 80, reasoning: 'valid long reasoning that is more than fifty characters long enough' }),
      promptTokens: 1_000_000,
      completionTokens: 1_000_000,
    });
    const result = await runStrategy(strategy, row);
    // gemini-2.5-flash: 0.075 in + 0.30 out per 1M = 0.375
    expect(result.metrics?.costUsd).toBeCloseTo(0.375, 4);
  });
});
```

- [ ] **Step 2: Run tests — verify failure**

Run: `npm test -- run-strategy`
Expected: Tests fail with "Cannot find module './run-strategy'".

- [ ] **Step 3: Implement `src/ai/eval/run-strategy.ts`**

```ts
'use server';

import {
  MetricsInvariantError,
  type Strategy,
  type EvalRow,
  type RunResult,
  type StrategyOutput,
} from '@/lib/eval/types';
import { promptVariants, promptInputFromRow } from '@/lib/eval/prompts';
import { scoreRunResult } from '@/lib/eval/metrics';
import { calculateCost } from '@/lib/eval/model-prices';
import { callOpenRouter } from './openrouter-client';

// Runs ONE strategy against ONE row (one LLM call). Never throws — returns a RunResult
// with the `error` field populated on failure so the sweep loop can continue.
export async function runStrategy(
  strategy: Strategy,
  row: EvalRow,
  runIndex: number = 0,
): Promise<RunResult> {
  const runId = `${strategy.id}__${row.id}__${runIndex}__${Date.now()}`;
  const timestamp = new Date().toISOString();

  const promptBuilder = promptVariants[strategy.promptVariant];
  if (!promptBuilder) {
    return base(runId, strategy.id, row.id, runIndex, timestamp, {
      error: `Unknown prompt variant: ${strategy.promptVariant}`,
    });
  }

  const promptText = promptBuilder(promptInputFromRow(row));

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
    return base(runId, strategy.id, row.id, runIndex, timestamp, { error: message });
  }
  const latencyMs = Date.now() - startTime;

  if (!callResult.content || callResult.content.trim() === '') {
    return base(runId, strategy.id, row.id, runIndex, timestamp, {
      error: 'LLM returned empty content',
      rawOutput: callResult.content,
    });
  }

  const cleaned = stripCodeFences(callResult.content);

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return base(runId, strategy.id, row.id, runIndex, timestamp, {
      error: `Failed to parse LLM output as JSON: ${message}`,
      rawOutput: callResult.content,
    });
  }

  const output = parsed as Partial<StrategyOutput> | null;
  if (!output || typeof output.score !== 'number' || typeof output.reasoning !== 'string') {
    return base(runId, strategy.id, row.id, runIndex, timestamp, {
      error: 'LLM output does not match {score: number, reasoning: string} shape',
      rawOutput: callResult.content,
    });
  }

  let qualityMetrics;
  try {
    qualityMetrics = scoreRunResult(output as StrategyOutput, row.expected);
  } catch (err) {
    const message =
      err instanceof MetricsInvariantError
        ? err.message
        : `Metrics error: ${err instanceof Error ? err.message : String(err)}`;
    return base(runId, strategy.id, row.id, runIndex, timestamp, {
      error: message,
      output: output as StrategyOutput,
      rawOutput: callResult.content,
    });
  }

  const costUsd = calculateCost(strategy.model, callResult.promptTokens, callResult.completionTokens);

  return {
    id: runId,
    strategyId: strategy.id,
    rowId: row.id,
    runIndex,
    timestamp,
    output: output as StrategyOutput,
    rawOutput: callResult.content,
    metrics: {
      ...qualityMetrics,
      costUsd,
      latencyMs,
    },
  };
}

function base(
  id: string,
  strategyId: string,
  rowId: string,
  runIndex: number,
  timestamp: string,
  overrides: Partial<RunResult>,
): RunResult {
  return {
    id,
    strategyId,
    rowId,
    runIndex,
    timestamp,
    output: null,
    metrics: null,
    ...overrides,
  };
}

// Strip ```json ... ``` or ``` ... ``` fences some models add despite "no markdown" instructions.
function stripCodeFences(s: string): string {
  const trimmed = s.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fenceMatch) return fenceMatch[1].trim();
  return trimmed;
}
```

- [ ] **Step 4: Run tests — all should pass**

Run: `npm test -- run-strategy`
Expected: All 8 tests pass.

- [ ] **Step 5: Run full test suite**

Run: `npm test`
Expected: All tests pass across metrics, plan-sweep, prompts, store, run-strategy (35+ tests total).

- [ ] **Step 6: Run typecheck**

Run: `npm run typecheck`
Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add src/ai/eval/run-strategy.ts src/ai/eval/run-strategy.test.ts
git commit -m "$(cat <<'EOF'
feat(eval v2): add runStrategy server action for pairwise scoring

Server action that runs one strategy against one row with an optional
runIndex (for sweep-level repeat runs). Returns a RunResult with
output + metrics on success, or with an error field + rawOutput on
failure. Never throws so the sweep loop can continue past individual
failures.

Handles: OpenRouter HTTP errors, empty content, markdown code fence
wrapping, malformed JSON, wrong output shape, score out of range,
empty reasoning (via MetricsInvariantError from scoreRunResult).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Eval page — shell + Dataset tab

Phase C begins. This task rebuilds `src/app/eval/page.tsx` (currently an "Under construction" stub) with the full 4-tab shell and a functional Dataset tab. Strategies, Run, and Results tabs remain placeholders until Tasks 11-14.

**Files:**
- Create: `src/lib/eval/undo-delete.ts` (small helper shared between Dataset + Strategies tabs)
- Modify: `src/app/eval/page.tsx` (replace stub)

- [ ] **Step 1: Create `src/lib/eval/undo-delete.ts`**

```ts
// Small helper for deferred-delete-with-undo. Holds a timer per pending delete;
// if commit is called the store operation fires, if cancel is called the timer
// is cleared so the store is never touched.

export interface PendingDelete<T> {
  item: T;
  cancel: () => void;      // call to restore (clears the timer)
  // commit() is called automatically by the internal timer when it expires
}

export function scheduleDelete<T>(
  item: T,
  commitFn: () => void | Promise<void>,
  delayMs: number = 6000,
): PendingDelete<T> {
  let cancelled = false;
  const timer = setTimeout(async () => {
    if (cancelled) return;
    await commitFn();
  }, delayMs);

  return {
    item,
    cancel: () => {
      cancelled = true;
      clearTimeout(timer);
    },
  };
}
```

- [ ] **Step 2: Replace `src/app/eval/page.tsx` entirely with the new shell + Dataset tab**

```tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { LocalStorageEvalStore, type EvalStore } from '@/lib/eval/store';
import { scheduleDelete, type PendingDelete } from '@/lib/eval/undo-delete';
import { promptVariants, promptInputFromRow } from '@/lib/eval/prompts';
import type { EvalRow, PromptVariant } from '@/lib/eval/types';

export default function EvalPage() {
  const { toast } = useToast();

  // Store is created inside useEffect — localStorage is unavailable during SSR.
  const [store, setStore] = useState<LocalStorageEvalStore | null>(null);
  const [rows, setRows] = useState<EvalRow[]>([]);
  const [editingRow, setEditingRow] = useState<EvalRow | null>(null);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [searchText, setSearchText] = useState<string>('');

  useEffect(() => {
    const s = new LocalStorageEvalStore();
    setStore(s);
    s.getRows().then(setRows);
    if (s.consumeV1WipeNotice()) {
      toast({
        title: 'Eval framework upgraded to v2',
        description: 'Previous data was reset. Seed examples loaded.',
      });
    }
  }, [toast]);

  async function handleSaveRow(updated: EvalRow) {
    if (!store) return;
    await store.saveRow(updated);
    setRows(await store.getRows());
    setEditingRow(null);
  }

  function handleDeleteRow(row: EvalRow) {
    if (!store) return;
    // Optimistic remove from state.
    setRows(current => current.filter(r => r.id !== row.id));
    // Schedule the actual store delete for 6s later.
    const pending: PendingDelete<EvalRow> = scheduleDelete(
      row,
      async () => {
        await store.deleteRow(row.id);
        await store.deleteResultsForRow(row.id);
      },
    );
    toast({
      title: `Deleted "${row.label}"`,
      description: 'Click undo to restore.',
      action: (
        <button
          className="underline text-sm"
          onClick={() => {
            pending.cancel();
            setRows(current => [...current, row]);
          }}
        >
          Undo
        </button>
      ),
    });
  }

  function handleNewRow() {
    setEditingRow({
      id: `row-${Date.now()}`,
      label: 'New row',
      profileA: '',
      profileB: '',
      expected: { score: 50, reasoning: '' },
      tags: [],
    });
  }

  // Derive the visible rows from tag + search filters.
  const visibleRows = rows.filter(r => {
    if (tagFilter && !r.tags.includes(tagFilter)) return false;
    if (searchText && !r.label.toLowerCase().includes(searchText.toLowerCase())) return false;
    return true;
  });

  // Collect all tags for the filter dropdown.
  const allTags = Array.from(new Set(rows.flatMap(r => r.tags))).sort();

  return (
    <div className="max-w-6xl mx-auto p-6 pt-20 min-h-screen">
      <header className="mb-8">
        <h1 className="text-3xl font-black text-white">Find-Matches Eval v2</h1>
        <p className="text-white/60">
          Compare LLMs, prompts, and strategies against labeled pairwise profiles.
        </p>
      </header>

      <Tabs defaultValue="dataset">
        <TabsList>
          <TabsTrigger value="dataset">Dataset</TabsTrigger>
          <TabsTrigger value="strategies">Strategies</TabsTrigger>
          <TabsTrigger value="run">Run</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
        </TabsList>

        <TabsContent value="dataset" className="mt-6 space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Button onClick={handleNewRow}>+ New Row</Button>
            <Input
              placeholder="Search labels..."
              className="max-w-xs"
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
            />
            <select
              className="border rounded px-3 py-2 bg-background text-sm"
              value={tagFilter ?? ''}
              onChange={e => setTagFilter(e.target.value || null)}
            >
              <option value="">All tags</option>
              {allTags.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <div className="text-sm text-white/60 ml-auto">
              {visibleRows.length} / {rows.length} rows
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {visibleRows.map(r => (
              <Card
                key={r.id}
                id={`row-${r.id}`}
                className="p-4 cursor-pointer hover:border-white/30 transition-colors"
                onClick={() => setEditingRow(r)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="font-bold">{r.label}</div>
                  <div className="flex gap-1 flex-wrap justify-end max-w-[50%]">
                    {r.tags.map(t => (
                      <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
                    ))}
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <div>
                    <div className="text-xs uppercase text-white/50">Profile A</div>
                    <div className="line-clamp-3">{r.profileA}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-white/50">Profile B</div>
                    <div className="line-clamp-3">{r.profileB}</div>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-3">
                  <div className="text-2xl font-black">{r.expected.score}</div>
                  <div className="text-xs italic text-white/60 flex-1 line-clamp-2">{r.expected.reasoning}</div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={e => {
                      e.stopPropagation();
                      handleDeleteRow(r);
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </Card>
            ))}
          </div>

          {visibleRows.length === 0 && (
            <div className="text-center text-white/40 py-12">
              {rows.length === 0 ? 'No rows yet. Click "+ New Row" to add one.' : 'No rows match the current filter.'}
            </div>
          )}
        </TabsContent>

        <TabsContent value="strategies">Strategies tab (Task 11)</TabsContent>
        <TabsContent value="run">Run tab (Tasks 12-13)</TabsContent>
        <TabsContent value="results">Results tab (Task 14)</TabsContent>
      </Tabs>

      <EditRowDialog
        row={editingRow}
        onClose={() => setEditingRow(null)}
        onSave={handleSaveRow}
      />
    </div>
  );
}

function EditRowDialog({
  row,
  onClose,
  onSave,
}: {
  row: EvalRow | null;
  onClose: () => void;
  onSave: (r: EvalRow) => void;
}) {
  const [draft, setDraft] = useState<EvalRow | null>(null);
  const [promptVariant, setPromptVariant] = useState<PromptVariant>('default');
  const [newTag, setNewTag] = useState<string>('');

  useEffect(() => {
    setDraft(row);
    setPromptVariant('default');
    setNewTag('');
  }, [row]);

  if (!draft) return null;

  const promptPreview = promptVariants[promptVariant](promptInputFromRow(draft));

  function addTag() {
    if (!draft || !newTag.trim()) return;
    if (draft.tags.includes(newTag.trim())) return;
    setDraft({ ...draft, tags: [...draft.tags, newTag.trim()] });
    setNewTag('');
  }

  function removeTag(tag: string) {
    if (!draft) return;
    setDraft({ ...draft, tags: draft.tags.filter(t => t !== tag) });
  }

  return (
    <Dialog open={!!row} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>
            <Input
              value={draft.label}
              onChange={e => setDraft({ ...draft, label: e.target.value })}
              className="text-lg font-bold"
            />
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold uppercase">Tags</label>
            <div className="flex flex-wrap gap-1 mb-2">
              {draft.tags.map(t => (
                <Badge key={t} variant="outline" className="text-xs">
                  {t}
                  <button
                    className="ml-1 text-white/50 hover:text-white"
                    onClick={() => removeTag(t)}
                  >×</button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="add tag"
                value={newTag}
                onChange={e => setNewTag(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                className="max-w-xs"
              />
              <Button size="sm" variant="outline" onClick={addTag}>Add</Button>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold uppercase">Profile A</label>
            <textarea
              className="w-full border rounded p-2 bg-background min-h-[100px]"
              value={draft.profileA}
              onChange={e => setDraft({ ...draft, profileA: e.target.value })}
            />
          </div>

          <div>
            <label className="text-xs font-bold uppercase">Profile B</label>
            <textarea
              className="w-full border rounded p-2 bg-background min-h-[100px]"
              value={draft.profileB}
              onChange={e => setDraft({ ...draft, profileB: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-[auto_1fr] gap-3 items-start">
            <div>
              <label className="text-xs font-bold uppercase">Expected Score</label>
              <Input
                type="number"
                min={0}
                max={100}
                value={draft.expected.score}
                onChange={e =>
                  setDraft({ ...draft, expected: { ...draft.expected, score: Number(e.target.value) } })
                }
                className="w-24"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase">Expected Reasoning</label>
              <textarea
                className="w-full border rounded p-2 bg-background min-h-[60px]"
                value={draft.expected.reasoning}
                onChange={e =>
                  setDraft({ ...draft, expected: { ...draft.expected, reasoning: e.target.value } })
                }
              />
            </div>
          </div>

          <div>
            <div className="flex items-center gap-3 mb-1">
              <label className="text-xs font-bold uppercase">Prompt preview (read-only)</label>
              <select
                className="border rounded px-2 py-1 text-xs bg-background"
                value={promptVariant}
                onChange={e => setPromptVariant(e.target.value as PromptVariant)}
              >
                <option value="default">default</option>
                <option value="simplified">simplified</option>
              </select>
            </div>
            <pre className="border rounded p-3 bg-black/40 text-xs whitespace-pre-wrap font-mono max-h-[200px] overflow-auto">
              {promptPreview}
            </pre>
            <div className="text-xs text-white/40 mt-1">
              To edit prompts, modify <code>src/lib/eval/prompts.ts</code>. UI prompt editing is deferred to v2.1.
            </div>
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

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: 0 errors.

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: All existing tests still pass (page.tsx has no tests).

- [ ] **Step 5: Manual smoke test**

Run: `npm run dev`. Visit `http://localhost:9002/eval` in a browser.

Verify:
- Page loads with "Find-Matches Eval v2" header
- If you previously had v1 data: a toast announces the v2 upgrade
- Dataset tab shows 4 seeded row cards (Alex/Sam, Jordan/Riley, Taylor/Morgan, Avery/Quinn)
- Each card displays label, tags, truncated profiles, expected score, expected reasoning
- Clicking a card opens the edit dialog with textareas for profiles and an editable tag list
- Prompt preview section shows the rendered prompt; switching variant updates the preview
- Editing a field and clicking Save persists on reload
- Clicking Delete on a card triggers a toast with Undo; clicking Undo within 6s restores; waiting 6s commits the delete
- Tag filter dropdown narrows the list
- Search box filters by label
- "+ New Row" opens the dialog with empty fields

Stop dev server (Ctrl-C) when done.

- [ ] **Step 6: Commit**

```bash
git add src/app/eval/page.tsx src/lib/eval/undo-delete.ts
git commit -m "$(cat <<'EOF'
feat(eval v2): Dataset tab with card list + detail dialog + undo delete

Replaces the v2 stub with the full page shell (4 tabs) and a
functional Dataset tab. Row cards show label + tags + truncated
profiles + expected score. Clicking a card opens a detail dialog
with textareas for profile A/B, expected score/reasoning, tag
management, and a read-only prompt preview.

Undo delete: 6s deferred commit via scheduleDelete helper. Toast
with Undo button restores the row without touching the store.

Cascade: confirmed deletes trigger deleteResultsForRow.

v1 migration: displays a one-time toast when the store wipes old data.

Strategies/Run/Results tabs remain placeholders for Tasks 11-14.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Strategies tab (CRUD + tooltip + undo delete)

**Files:**
- Modify: `src/app/eval/page.tsx`

- [ ] **Step 1: Add imports + state for strategies**

At the top of `src/app/eval/page.tsx`, in the imports block, add `Strategy` to the existing type import from `@/lib/eval/types`:

```tsx
import type { EvalRow, PromptVariant, Strategy } from '@/lib/eval/types';
```

Inside `EvalPage`, after the `handleNewRow` function, add:

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

  function handleDeleteStrategy(s: Strategy) {
    if (!store) return;
    setStrategies(current => current.filter(x => x.id !== s.id));
    const pending: PendingDelete<Strategy> = scheduleDelete(s, async () => {
      await store.deleteStrategy(s.id);
      await store.deleteResultsForStrategy(s.id);
    });
    toast({
      title: `Deleted "${s.name}"`,
      description: 'Click undo to restore.',
      action: (
        <button
          className="underline text-sm"
          onClick={() => {
            pending.cancel();
            setStrategies(current => [...current, s]);
          }}
        >
          Undo
        </button>
      ),
    });
  }

  function handleNewStrategy() {
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

Find this line in the JSX:

```tsx
        <TabsContent value="strategies">Strategies tab (Task 11)</TabsContent>
```

Replace it with:

```tsx
        <TabsContent value="strategies" className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-white/60">{strategies.length} strategies</div>
            <Button onClick={handleNewStrategy}>+ Add Strategy</Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {strategies.map(s => (
              <Card key={s.id} id={`strategy-${s.id}`} className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-bold">{s.name}</div>
                    <div className="text-xs font-mono text-white/60">{s.model}</div>
                    <div className="text-xs text-white/50 mt-1">
                      prompt: {s.promptVariant} · runCount: {s.runCount}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setEditingStrategy(s)}>Edit</Button>
                    <Button size="sm" variant="destructive" onClick={() => handleDeleteStrategy(s)}>Delete</Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>
```

- [ ] **Step 3: Add the EditStrategyDialog component at the bottom of the file**

At the very bottom of `src/app/eval/page.tsx` (after `EditRowDialog`), add:

```tsx
const KNOWN_MODELS = [
  'google/gemini-2.5-flash',
  'anthropic/claude-sonnet-4',
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
            <label className="text-xs font-bold uppercase flex items-center gap-1">
              Run count
              <span
                className="text-white/40 cursor-help"
                title="Advanced: how many internal LLM calls the strategy's algorithm makes (e.g. 'median of 3'). Keep at 1 unless you're using a median-of-N strategy. For repeating the whole evaluation N times, use 'Repeat runs' on the Run tab."
              >?</span>
            </label>
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

- [ ] **Step 4: Render EditStrategyDialog in the main JSX**

Find the line with `<EditRowDialog` and add the `EditStrategyDialog` right after it:

```tsx
      <EditRowDialog
        row={editingRow}
        onClose={() => setEditingRow(null)}
        onSave={handleSaveRow}
      />

      <EditStrategyDialog
        strategy={editingStrategy}
        onClose={() => setEditingStrategy(null)}
        onSave={handleSaveStrategy}
      />
```

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck`
Expected: 0 errors.

- [ ] **Step 6: Manual smoke test**

Run: `npm run dev`. Visit `/eval`, switch to Strategies tab.

Verify:
- Shows the 4 seeded strategies (including `claude-sonnet-4` — the fixed ID)
- "+ Add Strategy" opens the dialog with defaults
- Editing a strategy and saving persists on reload
- Tooltip on the "?" next to Run count shows the explanation on hover
- Deleting a strategy triggers an undo toast

Stop dev server.

- [ ] **Step 7: Commit**

```bash
git add src/app/eval/page.tsx
git commit -m "$(cat <<'EOF'
feat(eval v2): Strategies tab with CRUD + runCount tooltip + undo delete

Add/edit/delete strategies. Model picker uses the hardcoded list of
4 OpenRouter IDs matching the price table (including claude-sonnet-4,
the Sonnet bug fix). Prompt variant selector + runCount input with a
tooltip explaining the difference between internal runCount and
sweep-level repeat runs (item 5 resolution).

Delete uses the same undo pattern as rows: optimistic state removal,
6s toast, cascade deleteResultsForStrategy on commit.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: Run tab — configuration + cost preview + execution

This is the largest UI task. It covers: row/strategy selection with checkboxes, repeat count input, tag filter, cost preview, confirmation dialog with overflow warnings and large-sweep warning, sequential run loop with progress, cancel button.

**Files:**
- Modify: `src/app/eval/page.tsx`

- [ ] **Step 1: Add imports at the top of the file**

Update the imports at the top of `src/app/eval/page.tsx`:

```tsx
import { useEffect, useState, useRef, useCallback } from 'react';
// ... existing shadcn imports ...
import { runStrategy } from '@/ai/eval/run-strategy';
import { planSweep, type SweepPlan, type OverflowWarning } from '@/lib/eval/plan-sweep';
import type { EvalRow, PromptVariant, Strategy, RunResult } from '@/lib/eval/types';
```

- [ ] **Step 2: Add Run tab state + handlers inside `EvalPage`**

After `handleNewStrategy`, add:

```tsx
  // --- Run tab state ---
  const LARGE_SWEEP_THRESHOLD = 50;

  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [selectedStrategyIds, setSelectedStrategyIds] = useState<Set<string>>(new Set());
  const [repeatCount, setRepeatCount] = useState<number>(1);
  const [runTagFilter, setRunTagFilter] = useState<string | null>(null);
  const [runPlan, setRunPlan] = useState<SweepPlan | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState<boolean>(false);

  const [results, setResults] = useState<RunResult[]>([]);
  const [running, setRunning] = useState<boolean>(false);
  const [progress, setProgress] = useState<string>('');
  const cancelledRef = useRef<boolean>(false);

  // Load results on mount / after store ready.
  useEffect(() => {
    if (!store) return;
    store.getResults().then(setResults);
  }, [store]);

  // Seed selections to "all" when rows/strategies arrive.
  useEffect(() => {
    setSelectedRowIds(new Set(rows.map(r => r.id)));
  }, [rows]);
  useEffect(() => {
    setSelectedStrategyIds(new Set(strategies.map(s => s.id)));
  }, [strategies]);

  // Re-plan whenever selection or repeat count changes.
  useEffect(() => {
    const selectedRows = rows.filter(r => {
      if (!selectedRowIds.has(r.id)) return false;
      if (runTagFilter && !r.tags.includes(runTagFilter)) return false;
      return true;
    });
    const selectedStrategies = strategies.filter(s => selectedStrategyIds.has(s.id));
    if (selectedRows.length === 0 || selectedStrategies.length === 0) {
      setRunPlan(null);
      return;
    }
    setRunPlan(planSweep(selectedRows, selectedStrategies, repeatCount));
  }, [rows, strategies, selectedRowIds, selectedStrategyIds, repeatCount, runTagFilter]);

  function toggleRowSelection(id: string) {
    setSelectedRowIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleStrategySelection(id: string) {
    setSelectedStrategyIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openConfirmDialog() {
    if (!runPlan || runPlan.runnable.length === 0) return;
    setShowConfirmDialog(true);
  }

  async function executeSweep() {
    if (!store || !runPlan || running) return;
    setShowConfirmDialog(false);
    setRunning(true);
    cancelledRef.current = false;
    const total = runPlan.runnable.length;
    let i = 0;
    for (const item of runPlan.runnable) {
      if (cancelledRef.current) break;
      i++;
      setProgress(
        `Running ${item.strategy.name} on "${item.row.label}" (${i}/${total}, run ${item.runIndex + 1}/${repeatCount})`,
      );
      const result = await runStrategy(item.strategy, item.row, item.runIndex);
      await store.saveResult(result);
      setResults(await store.getResults());
    }
    if (cancelledRef.current) {
      setProgress(`Cancelled (${i}/${total} complete)`);
    } else {
      setProgress(`Done (${total}/${total})`);
    }
    setRunning(false);
  }

  function cancelSweep() {
    cancelledRef.current = true;
  }

  async function handleClearResults() {
    if (!store) return;
    await store.clearResults();
    setResults([]);
  }
```

- [ ] **Step 3: Replace the Run TabsContent placeholder**

Find this line in the JSX:

```tsx
        <TabsContent value="run">Run tab (Tasks 12-13)</TabsContent>
```

Replace it with:

```tsx
        <TabsContent value="run" className="mt-6 space-y-4">
          <Card className="p-4 space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-bold uppercase">
                  Rows ({selectedRowIds.size} / {rows.length} selected)
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setSelectedRowIds(new Set(rows.map(r => r.id)))}>All</Button>
                  <Button size="sm" variant="outline" onClick={() => setSelectedRowIds(new Set())}>None</Button>
                </div>
              </div>
              <div className="space-y-1 max-h-48 overflow-auto border rounded p-2">
                {rows.map(r => (
                  <label key={r.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-white/5 p-1 rounded">
                    <input
                      type="checkbox"
                      checked={selectedRowIds.has(r.id)}
                      onChange={() => toggleRowSelection(r.id)}
                    />
                    <span className="flex-1">{r.label}</span>
                    <div className="flex gap-1">
                      {r.tags.slice(0, 3).map(t => <Badge key={t} variant="outline" className="text-xs">{t}</Badge>)}
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-bold uppercase">
                  Strategies ({selectedStrategyIds.size} / {strategies.length} selected)
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setSelectedStrategyIds(new Set(strategies.map(s => s.id)))}>All</Button>
                  <Button size="sm" variant="outline" onClick={() => setSelectedStrategyIds(new Set())}>None</Button>
                </div>
              </div>
              <div className="space-y-1 border rounded p-2">
                {strategies.map(s => (
                  <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-white/5 p-1 rounded">
                    <input
                      type="checkbox"
                      checked={selectedStrategyIds.has(s.id)}
                      onChange={() => toggleStrategySelection(s.id)}
                    />
                    <span className="flex-1">{s.name}</span>
                    <span className="text-xs font-mono text-white/50">{s.model}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div>
                <label className="text-xs font-bold uppercase block">Repeat runs</label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={repeatCount}
                  onChange={e => setRepeatCount(Math.max(1, Number(e.target.value)))}
                  className="w-20"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase block">Tag filter (rows)</label>
                <select
                  className="border rounded px-3 py-2 bg-background text-sm"
                  value={runTagFilter ?? ''}
                  onChange={e => setRunTagFilter(e.target.value || null)}
                >
                  <option value="">(none)</option>
                  {allTags.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            <div className="border-t pt-3 space-y-1 text-sm">
              {runPlan ? (
                <>
                  <div>Total runs: <strong>{runPlan.runCount}</strong></div>
                  <div>
                    Estimated cost: <strong>${runPlan.estimatedUsd.toFixed(4)}</strong>
                    <span className="text-white/60 ml-2">(${(runPlan.estimatedUsd * 1000 / Math.max(1, runPlan.runCount)).toFixed(2)} per 1000 calls)</span>
                    {runPlan.unknownModelCount > 0 && <span className="text-yellow-400 ml-2">+{runPlan.unknownModelCount} unknown</span>}
                  </div>
                  <div>Estimated time: <strong>~{formatSeconds(runPlan.estimatedSeconds)}</strong></div>
                  <div>Skipped: <strong>{runPlan.skipped.length}</strong> (context window overflow)</div>
                </>
              ) : (
                <div className="text-white/50">Select at least one row and one strategy.</div>
              )}
            </div>

            {!running ? (
              <Button
                onClick={openConfirmDialog}
                disabled={!runPlan || runPlan.runnable.length === 0}
              >
                Run selected
              </Button>
            ) : (
              <div className="space-y-2">
                <div className="text-sm font-mono text-white/80">{progress}</div>
                <Button variant="destructive" onClick={cancelSweep}>Stop</Button>
              </div>
            )}
            {!running && progress && (
              <div className="text-sm font-mono text-white/60">{progress}</div>
            )}
          </Card>
        </TabsContent>
```

- [ ] **Step 4: Add `formatSeconds` helper at the bottom of the file**

At the bottom of `src/app/eval/page.tsx` (after the `KNOWN_MODELS` constant), add:

```tsx
function formatSeconds(s: number): string {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  return rs === 0 ? `${m}m` : `${m}m ${rs}s`;
}
```

- [ ] **Step 5: Add the confirmation dialog before the closing `</div>`**

Right before `</div>` at the end of the `EvalPage` return (after `<EditStrategyDialog ... />`), add:

```tsx
      <Dialog open={showConfirmDialog} onOpenChange={(open) => !open && setShowConfirmDialog(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Confirm run</DialogTitle>
          </DialogHeader>
          {runPlan && (
            <div className="space-y-3 text-sm">
              <div>
                About to run <strong>{runPlan.runCount}</strong> evaluations
                {runPlan.skipped.length > 0 && <> (<strong>{runPlan.skipped.length}</strong> skipped)</>}.
              </div>
              <div>Estimated cost: <strong>${runPlan.estimatedUsd.toFixed(4)}</strong> (${(runPlan.estimatedUsd * 1000 / Math.max(1, runPlan.runCount)).toFixed(2)} per 1000 calls)</div>
              <div>Estimated time: <strong>~{formatSeconds(runPlan.estimatedSeconds)}</strong></div>

              {runPlan.skipped.length > 0 && (
                <div className="border-l-4 border-yellow-500 pl-3 py-1 text-yellow-200/90 text-xs">
                  <div className="font-bold uppercase mb-1">⚠ Skipped due to context window overflow:</div>
                  <ul className="list-disc list-inside space-y-0.5">
                    {runPlan.skipped.slice(0, 5).map((w, i) => {
                      const strat = strategies.find(s => s.id === w.strategyId)?.name ?? w.strategyId;
                      const row = rows.find(r => r.id === w.rowId)?.label ?? w.rowId;
                      return (
                        <li key={i}>
                          {strat} × "{row}" ({(w.estimatedTokens / 1000).toFixed(1)}k / {(w.contextWindow / 1000).toFixed(0)}k)
                        </li>
                      );
                    })}
                    {runPlan.skipped.length > 5 && <li>… and {runPlan.skipped.length - 5} more</li>}
                  </ul>
                </div>
              )}

              {runPlan.runCount >= LARGE_SWEEP_THRESHOLD && (
                <div className="border-l-4 border-yellow-500 pl-3 py-1 text-yellow-200/90 text-xs">
                  <div className="font-bold uppercase">⚠ Large sweep</div>
                  <div>
                    {runPlan.runCount} runs will take ~{formatSeconds(runPlan.estimatedSeconds)} sequentially.
                    You can keep using other tabs while it runs, or cancel via the Stop button.
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>Cancel</Button>
            <Button onClick={executeSweep} disabled={!runPlan || runPlan.runCount === 0}>
              Run {runPlan?.runCount ?? 0} {runPlan && runPlan.skipped.length > 0 ? 'remaining' : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
```

- [ ] **Step 6: Run typecheck**

Run: `npm run typecheck`
Expected: 0 errors.

- [ ] **Step 7: Manual smoke test**

Run: `npm run dev`. Visit `/eval`, switch to Run tab.

Verify:
- Shows row list with checkboxes (all selected by default)
- Shows strategy list with checkboxes (all selected by default)
- Repeat runs input defaults to 1
- Tag filter dropdown lists all unique tags
- Total runs count updates when you change selection or repeat count (e.g. 4 rows × 4 strategies × 1 = 16)
- Estimated cost updates with selection
- Clicking "Run selected" opens the confirmation dialog
- Confirmation dialog shows cost + time + skipped warnings (if any)
- Clicking "Run 16" in the dialog starts the sweep: progress updates live
- Stop button cancels mid-sweep
- After completion, Results tab (still a placeholder) has stored RunResults in localStorage (inspect via DevTools → Application → Local Storage → eval.results)

Note: requires a valid `OPENROUTER_API_KEY` in `.env.local` for the actual API calls. If the key is missing, all runs will fail with an `EvalConfigError` — that's expected and the UI should still function.

Stop dev server.

- [ ] **Step 8: Commit**

```bash
git add src/app/eval/page.tsx
git commit -m "$(cat <<'EOF'
feat(eval v2): Run tab with selection, cost preview, and execution

- Row + strategy checkboxes with All/None buttons
- Repeat runs input (sweep-level Concept B)
- Tag filter for rows
- Live cost + time + skipped count preview via planSweep
- Confirmation dialog with overflow warnings + large-sweep warning
- Sequential execution loop with runIndex 0..repeatCount-1
- Progress text + Stop button (cancel flag checked between runs)
- Results saved to localStorage as each run completes

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: Results tab — Summary view

**Files:**
- Modify: `src/app/eval/page.tsx`

- [ ] **Step 1: Add imports**

Add at the top of `src/app/eval/page.tsx`:

```tsx
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { aggregateMetrics } from '@/lib/eval/metrics';
```

- [ ] **Step 2: Add `resultsView` state + Summary aggregation**

Inside `EvalPage`, after the `cancelledRef`, add:

```tsx
  const [resultsView, setResultsView] = useState<'summary' | 'detail'>('summary');

  // Aggregate results by strategyId for the Summary view.
  const summaryRows = strategies.map(s => {
    const strategyResults = results.filter(r => r.strategyId === s.id && r.metrics && r.output);
    const failedCount = results.filter(r => r.strategyId === s.id && r.error).length;
    if (strategyResults.length === 0) {
      return {
        strategy: s,
        runs: 0,
        avgScoreDelta: null as number | null,
        substantiveRate: null as number | null,
        avgCost: null as number | null,
        avgLatency: null as number | null,
        failed: failedCount,
      };
    }
    const agg = aggregateMetrics(strategyResults);
    return {
      strategy: s,
      runs: agg.runCount,
      avgScoreDelta: agg.avgScoreDelta,
      substantiveRate: agg.substantiveReasoningRate,
      avgCost: agg.avgCostUsd,
      avgLatency: agg.avgLatencyMs,
      failed: failedCount,
    };
  }).sort((a, b) => {
    // Lowest avgScoreDelta first; nulls go to the bottom.
    if (a.avgScoreDelta === null) return 1;
    if (b.avgScoreDelta === null) return -1;
    return a.avgScoreDelta - b.avgScoreDelta;
  });
```

- [ ] **Step 3: Replace the Results TabsContent placeholder**

Find:

```tsx
        <TabsContent value="results">Results tab (Task 14)</TabsContent>
```

Replace with:

```tsx
        <TabsContent value="results" className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <Button
                variant={resultsView === 'summary' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setResultsView('summary')}
              >Summary</Button>
              <Button
                variant={resultsView === 'detail' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setResultsView('detail')}
              >Detail</Button>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-sm text-white/60">{results.length} total runs stored</div>
              <Button variant="outline" size="sm" onClick={handleClearResults}>
                Clear all results
              </Button>
            </div>
          </div>

          {resultsView === 'summary' && (
            <Card className="p-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Strategy</TableHead>
                    <TableHead>Runs</TableHead>
                    <TableHead>Avg Δ score</TableHead>
                    <TableHead>Explainability</TableHead>
                    <TableHead>Cost / call</TableHead>
                    <TableHead>Cost / 1000</TableHead>
                    <TableHead>Avg latency</TableHead>
                    <TableHead>Failed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summaryRows.map(row => (
                    <TableRow key={row.strategy.id} id={`strategy-${row.strategy.id}`}>
                      <TableCell className="font-medium">{row.strategy.name}</TableCell>
                      <TableCell>{row.runs}</TableCell>
                      <TableCell>{row.avgScoreDelta === null ? '—' : `±${row.avgScoreDelta.toFixed(1)}`}</TableCell>
                      <TableCell>
                        {row.substantiveRate === null
                          ? '—'
                          : <span className={row.substantiveRate < 0.8 ? 'text-yellow-400' : ''}>
                              {(row.substantiveRate * 100).toFixed(0)}%
                              {row.substantiveRate < 0.8 && ' ⚠'}
                            </span>}
                      </TableCell>
                      <TableCell>{row.avgCost === null ? '—' : `$${row.avgCost.toFixed(6)}`}</TableCell>
                      <TableCell>{row.avgCost === null ? '—' : `$${(row.avgCost * 1000).toFixed(3)}`}</TableCell>
                      <TableCell>{row.avgLatency === null ? '—' : `${Math.round(row.avgLatency)}ms`}</TableCell>
                      <TableCell>
                        {row.failed > 0
                          ? <span className="text-red-500 font-bold">{row.failed}</span>
                          : <span className="text-white/40">0</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}

          {resultsView === 'detail' && (
            <Card className="p-4">
              <div className="text-white/50 text-sm">Detail view coming in Task 14.</div>
            </Card>
          )}
        </TabsContent>
```

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: 0 errors.

- [ ] **Step 5: Manual smoke test**

Run: `npm run dev`. Visit `/eval`, run a sweep from the Run tab, then switch to Results.

Verify:
- Segmented control shows Summary / Detail views
- Summary table shows one row per strategy with avgScoreDelta (lowest first), explainability %, cost per call, cost per 1000, avg latency, failed count
- Explainability < 80% shows with yellow text + ⚠
- Cost per 1000 is 1000x the per-call cost
- "Clear all results" empties the table

Stop dev server.

- [ ] **Step 6: Commit**

```bash
git add src/app/eval/page.tsx
git commit -m "$(cat <<'EOF'
feat(eval v2): Results tab Summary view

Aggregated per-strategy table sorted by avg score delta ascending.
Columns: Runs, Avg Δ, Explainability %, Cost/call, Cost/1000,
Latency, Failed. Explainability < 80% highlighted yellow with ⚠.
Cost per 1000 calls displayed alongside per-call for mental math.

Detail view stub; populated in Task 14.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 14: Results tab — Detail view + linked items

**Files:**
- Modify: `src/app/eval/page.tsx`

- [ ] **Step 1: Add Detail view state + navigation handlers inside `EvalPage`**

After the `summaryRows` derivation, add:

```tsx
  // Build the detail matrix: rows × strategies, with aggregated metrics per cell.
  interface DetailCell {
    rowId: string;
    strategyId: string;
    meanScore: number | null;
    stddev: number;
    delta: number | null;         // avg delta from expected
    runCount: number;
    results: RunResult[];
  }
  const detailCells = new Map<string, DetailCell>();   // key = `${rowId}|${strategyId}`
  for (const row of rows) {
    for (const s of strategies) {
      const key = `${row.id}|${s.id}`;
      const groupResults = results.filter(r =>
        r.rowId === row.id && r.strategyId === s.id && r.metrics && r.output,
      );
      if (groupResults.length === 0) {
        detailCells.set(key, { rowId: row.id, strategyId: s.id, meanScore: null, stddev: 0, delta: null, runCount: 0, results: [] });
      } else {
        const agg = aggregateMetrics(groupResults);
        const meanScore = groupResults.reduce((sum, r) => sum + (r.output?.score ?? 0), 0) / groupResults.length;
        detailCells.set(key, {
          rowId: row.id,
          strategyId: s.id,
          meanScore,
          stddev: agg.scoreStdDev,
          delta: agg.avgScoreDelta,
          runCount: agg.runCount,
          results: groupResults,
        });
      }
    }
  }

  const [selectedCell, setSelectedCell] = useState<DetailCell | null>(null);

  function linkToDatasetRow(rowId: string) {
    // Switch to dataset tab + scroll to row + highlight.
    const el = document.getElementById(`row-${rowId}`);
    // Navigate to dataset tab first by setting the underlying Radix tab value.
    // Since we use defaultValue on <Tabs>, we need a controlled activeTab state.
    setActiveTab('dataset');
    // After React re-renders the tab, scroll.
    setTimeout(() => {
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-2', 'ring-white');
        setTimeout(() => el.classList.remove('ring-2', 'ring-white'), 2000);
      }
    }, 100);
  }

  function linkToStrategy(strategyId: string) {
    const el = document.getElementById(`strategy-${strategyId}`);
    setActiveTab('strategies');
    setTimeout(() => {
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-2', 'ring-white');
        setTimeout(() => el.classList.remove('ring-2', 'ring-white'), 2000);
      }
    }, 100);
  }
```

- [ ] **Step 2: Convert `Tabs` to controlled mode**

Change the `<Tabs defaultValue="dataset">` line to use a controlled `activeTab` state. First, near the other state declarations at the top of `EvalPage`, add:

```tsx
  const [activeTab, setActiveTab] = useState<string>('dataset');
```

Then replace:

```tsx
      <Tabs defaultValue="dataset">
```

with:

```tsx
      <Tabs value={activeTab} onValueChange={setActiveTab}>
```

- [ ] **Step 3: Replace the "Detail view coming in Task 14" stub**

Find:

```tsx
          {resultsView === 'detail' && (
            <Card className="p-4">
              <div className="text-white/50 text-sm">Detail view coming in Task 14.</div>
            </Card>
          )}
```

Replace with:

```tsx
          {resultsView === 'detail' && (
            <Card className="p-4 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Row</TableHead>
                    <TableHead>Truth</TableHead>
                    {strategies.map(s => (
                      <TableHead key={s.id}>
                        <button
                          className="underline-offset-2 hover:underline text-left"
                          onClick={() => linkToStrategy(s.id)}
                        >
                          {s.name}
                        </button>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(row => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">
                        <button
                          className="underline-offset-2 hover:underline text-left"
                          onClick={() => linkToDatasetRow(row.id)}
                        >
                          {row.label}
                        </button>
                      </TableCell>
                      <TableCell className="font-bold">{row.expected.score}</TableCell>
                      {strategies.map(s => {
                        const cell = detailCells.get(`${row.id}|${s.id}`);
                        if (!cell || cell.runCount === 0) {
                          return <TableCell key={s.id} className="text-white/30">—</TableCell>;
                        }
                        const deltaWarning = (cell.delta ?? 0) > 20;
                        const stddevWarning = cell.stddev > 15;
                        return (
                          <TableCell
                            key={s.id}
                            className="cursor-pointer hover:bg-white/5"
                            onClick={() => setSelectedCell(cell)}
                          >
                            <span className={deltaWarning ? 'text-yellow-400' : ''}>
                              {cell.meanScore?.toFixed(0)}
                              {cell.runCount > 1 && <> <span className="text-white/50 text-xs">±{cell.stddev.toFixed(1)}</span></>}
                              {(deltaWarning || stddevWarning) && ' ⚠'}
                            </span>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                  <TableRow className="border-t-2">
                    <TableCell className="font-bold">Avg Δ</TableCell>
                    <TableCell></TableCell>
                    {strategies.map(s => {
                      const row = summaryRows.find(sr => sr.strategy.id === s.id);
                      return (
                        <TableCell key={s.id} className="font-bold">
                          {row?.avgScoreDelta === null || row?.avgScoreDelta === undefined
                            ? '—'
                            : `±${row.avgScoreDelta.toFixed(1)}`}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-bold">Explainability</TableCell>
                    <TableCell></TableCell>
                    {strategies.map(s => {
                      const row = summaryRows.find(sr => sr.strategy.id === s.id);
                      const rate = row?.substantiveRate;
                      return (
                        <TableCell key={s.id} className={rate !== null && rate !== undefined && rate < 0.8 ? 'text-yellow-400' : ''}>
                          {rate === null || rate === undefined ? '—' : `${(rate * 100).toFixed(0)}%${rate < 0.8 ? ' ⚠' : ''}`}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                </TableBody>
              </Table>
            </Card>
          )}
```

- [ ] **Step 4: Add the cell detail dialog**

Right before the closing `</div>` of `EvalPage` (after the existing confirmation dialog), add:

```tsx
      <Dialog open={!!selectedCell} onOpenChange={(open) => !open && setSelectedCell(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Run results detail</DialogTitle>
          </DialogHeader>
          {selectedCell && (
            <div className="space-y-3 text-sm">
              <div>
                <strong>{strategies.find(s => s.id === selectedCell.strategyId)?.name}</strong>
                {' × '}
                <strong>{rows.find(r => r.id === selectedCell.rowId)?.label}</strong>
              </div>
              <div className="text-white/70">
                {selectedCell.runCount} run{selectedCell.runCount !== 1 ? 's' : ''},
                mean {selectedCell.meanScore?.toFixed(1)}
                {selectedCell.runCount > 1 && <> ±{selectedCell.stddev.toFixed(1)}</>}
                , Δ {selectedCell.delta?.toFixed(1)}
              </div>
              <div className="space-y-3">
                {selectedCell.results.map(r => (
                  <div key={r.id} className="border rounded p-3 space-y-1">
                    <div className="text-xs text-white/50">
                      run {r.runIndex + 1}, {new Date(r.timestamp).toLocaleString()}
                    </div>
                    <div>Score: <strong>{r.output?.score}</strong></div>
                    <div className="text-white/80">{r.output?.reasoning}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setSelectedCell(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
```

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck`
Expected: 0 errors.

- [ ] **Step 6: Manual smoke test**

Run: `npm run dev`. Visit `/eval`, run a sweep, switch to Results → Detail.

Verify:
- Detail table has columns: Row, Truth, one per strategy (header names)
- Each row shows expected score in Truth column, model score in each strategy column
- Cells with repeatCount > 1 show `mean ±stddev`
- Cells with delta > 20 or stddev > 15 show yellow + ⚠
- Avg Δ and Explainability footer rows present
- Clicking a cell opens a dialog with all individual runs + reasoning text
- Clicking a row label in the detail table navigates to Dataset tab and highlights the row briefly
- Clicking a strategy column header navigates to Strategies tab and highlights the strategy briefly

Stop dev server.

- [ ] **Step 7: Commit**

```bash
git add src/app/eval/page.tsx
git commit -m "$(cat <<'EOF'
feat(eval v2): Results tab Detail view + linked navigation

Matrix table: rows × strategies, with Truth column + one per strategy.
Cells show mean ±stddev when repeatCount > 1. Yellow + ⚠ flags for
delta > 20 or stddev > 15. Footer rows aggregate Avg Δ and
Explainability per strategy.

Clicking a cell opens a dialog listing every run in that group with
its reasoning. Clicking a row label or strategy header navigates to
the corresponding tab, scrolls the item into view, and highlights it
for 2 seconds (URL-free implementation using controlled Tabs +
element IDs set in Tasks 10 and 11).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 15: Final polish + end-to-end smoke test

Catch-all task for the remaining cross-cutting polish: make sure everything from the spec's success criteria is in place, fix any small issues, run the full test suite, and do an end-to-end manual test.

**Files:**
- Potentially modify: `src/app/eval/page.tsx` (bug fixes)
- Modify: `docs/superpowers/specs/2026-04-10-eval-iteration-v2-design.md` (no changes expected — reference only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: All tests pass across metrics, plan-sweep, prompts, store, run-strategy. Total ~45+ tests.

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: 0 errors.

- [ ] **Step 3: Run the dev server and go through the full manual test checklist**

Run: `npm run dev`. Visit `http://localhost:9002/eval`. Work through each item from the spec's "Manual test checklist":

1. Page loads with 4 seeded rows and 4 seeded strategies (including `claude-sonnet-4`)
2. If you previously had v1 data: a toast announces the v2 upgrade
3. Editing a row's profileA/profileB/expected persists on reload
4. Tag filter narrows the row list on the Dataset tab
5. Selecting a subset on the Run tab updates estimated cost + time
6. Sweep with `repeatCount = 3` produces 3 `RunResult`s per combination (check Results detail view)
7. Results detail view shows `mean ±stddev` when `repeatCount > 1`; stddev > 15 shows ⚠
8. Adding a 50k-char profile to a row triggers overflow check: Llama 8B combinations skipped with a warning in the confirmation dialog
9. Large-sweep warning appears when selecting enough rows/strategies to hit ≥50 total runs
10. Stop button cancels a running sweep cleanly; remaining runs never fire
11. Undo delete restores a row within 6s; waiting 6s persists the delete and cascades results
12. Clicking a row name in Results detail → Dataset tab opens, row scrolled into view + highlighted for 2s
13. Clicking a strategy name in Results detail → Strategies tab equivalent
14. Sonnet strategy actually runs without the v1 404 error (requires real `OPENROUTER_API_KEY`)

If anything is broken, fix it inline and verify again. Common likely issues:
- Typos in element IDs breaking the linked navigation (`row-${id}` vs `row_${id}`)
- Missing `key` props on mapped elements (React console warnings)
- `activeTab` not updating when linked navigation fires
- Undo toast action not having `onClick` bound

- [ ] **Step 4: Fix any issues found in Step 3**

For each issue, make the minimal fix directly in `src/app/eval/page.tsx`. If no issues are found, skip this step.

- [ ] **Step 5: Re-run tests + typecheck after fixes**

Run: `npm test && npm run typecheck`
Expected: all pass.

- [ ] **Step 6: Commit (if any fixes were made)**

```bash
git add src/app/eval/page.tsx
git commit -m "$(cat <<'EOF'
fix(eval v2): end-to-end smoke test polish

Final fixes after walking through the v2 manual test checklist:
<describe the actual fixes you made — do not commit this message
unchanged if no fixes were needed>

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

If no fixes were needed, skip the commit and report the task as complete.

---

## Done

At this point eval v2 is complete:

- `/eval` page with pairwise data model: 4 seeded `EvalRow`s, each with two text profiles + expected score + reasoning + tags
- 4 seeded strategies (Sonnet bug fixed: `claude-sonnet-4`)
- Dataset tab: card list with tag filter + search, detail dialog with profile editing + tag management + read-only prompt preview, undo delete
- Strategies tab: CRUD + runCount tooltip + undo delete
- Run tab: row/strategy selection, repeat runs, tag filter, live cost preview, confirmation dialog with overflow + large-sweep warnings, sequential execution with cancel
- Results tab: Summary view (per-strategy aggregates, cost per 1000 column, explainability warnings) + Detail view (rows × strategies matrix, mean±stddev cells, cell drill-down dialog, linked navigation)
- All metrics: `scoreDelta`, `reasoningLength`, `hasSubstantiveReasoning` (item 18), aggregated with `scoreStdDev`
- Context window pre-flight check via `planSweep`
- v1 migration with one-time toast
- SSR-safe via `useEffect` initialization

### Success criteria check (from spec)

1. ✅ `/eval` loads with 4 seeded text-based rows and 4 seeded strategies
2. ✅ Row detail dialog shows full profile A + profile B text + expected score + prompt preview
3. ✅ Run tab lets you select a subset, see estimated cost + time + overflow warnings, and confirm before running
4. ✅ Repeat runs produces N `RunResult`s per combination; Detail view shows `mean ±stddev`
5. ✅ Results detail table shows ground truth + per-strategy columns; linked navigation works
6. ✅ Undo delete works on rows and strategies
7. ✅ Sonnet strategy runs without the v1 404 error (verified manually with a real key)
8. ✅ Context window overflow detected and skipped before running; listed in confirmation dialog
9. ✅ `npm run test` passes all unit tests
10. ✅ `npm run typecheck` passes with 0 errors
11. ✅ v1 localStorage data is auto-wiped and re-seeded with a one-time toast

### Explicitly deferred to v2.1 or later (from spec)

- Median-of-N strategy algorithm **implementation** (data model supports it via `runCount`; wrapper not built)
- Editing prompt variants from the UI (v2.0 shows read-only preview)
- LLM-as-judge as a secondary quality signal
- Dataset import/export
- Supabase persistence (the `EvalStore` interface is still the swap point)
- "Shorten profile automatically to fit context window" helper
