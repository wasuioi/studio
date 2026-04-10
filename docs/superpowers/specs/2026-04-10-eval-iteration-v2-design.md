# Find-Matches Eval Framework — Iteration v2 Design

**Date**: 2026-04-10
**Branch**: `ai-eval-framework` (v2 continues on the same branch as v1)
**Status**: Design approved, ready for implementation plan
**Previous spec**: `docs/superpowers/specs/2026-04-10-find-matches-eval-framework-design.md` (v1)

## Goal

Rework the eval framework from a candidate-list-based model (tied to the production `findMatches` flow structure) to a simpler pairwise text-to-text compatibility scoring model. Along the way, address 17+ rough edges found while testing v1 — bug fixes, workflow improvements, visibility features, and quality-of-life polish.

## Non-Goals

- Not touching the production `src/ai/flows/find-matches-flow.ts` flow. **The eval framework is now completely independent from production.** v1's "test the same thing production does" assumption is dropped.
- Not implementing the median-of-N strategy algorithm (Concept A) itself. v2 keeps `runCount` on the Strategy type with a tooltip explaining what it's for, but actual median-of-N wrapping is deferred to v2.1.
- Not adding LLM-as-judge as a quality signal. Scores stay human-labeled.
- Not building a dataset import/export feature.
- Not migrating v1 localStorage data — on upgrade, v1 data is wiped and v2 re-seeds from scratch.

## Context

v1 shipped successfully (12 commits on `ai-eval-framework`, 28 tests passing, `/eval` page functional). When the user tested it, they identified 14 TODO items and made one major direction call: **the eval framework should be its own thing, independent from production**. Each "row" should be a simple pairwise comparison: two plain-text profile descriptions, one expected compatibility score, one expected reasoning. No more candidate lists, no more structured persona/ideal_partner/tags fields, no more unidirectional/reciprocity split in the output.

This simplification resolves several confusion points in one shot, eliminates ~40% of the v1 code, and opens the door to the workflow features the user wanted. It's a directionally different design from v1, but it reuses most of v1's infrastructure (Vitest, LocalStorageEvalStore, OpenRouter client, run-strategy server action, tab shell, shadcn components).

## User-approved decisions

| Decision | Choice |
|---|---|
| Data model | Pairwise: `EvalRow { profileA: string, profileB: string, expected: {score, reasoning}, tags[] }` |
| Scope of production flow | **Not touched**. Eval framework is a separate system. |
| Strategy runCount (Concept A) | Keep in data model with tooltip; actual median-of-N wrapper deferred to v2.1 |
| Repeat runs (Concept B) | Sweep-level config: run each {row × strategy} combination N times, average metrics (not scores) |
| Metrics | `scoreDelta` (abs diff from expected), `reasoningLength`, `hasSubstantiveReasoning`, cost, latency. New: `scoreStdDev` on raw scores when repeatCount > 1. |
| Quality signal | Human-labeled (4 seed rows). Same as v1. |
| Storage | `localStorage` via same `EvalStore` interface; rename `eval.pairs` → `eval.rows`; v1 data wiped on first v2 load |
| Providers | OpenRouter (unchanged). Fix Sonnet bug by using a current model ID. |
| UI shape | Same 4-tab `/eval` page, but every tab's content is rewritten |

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  Browser  (src/app/eval/page.tsx)                            │
│  ──────────────────────────────────                          │
│  • Dataset tab    (row list → detail dialog with full text) │
│  • Strategies tab (unchanged CRUD + tooltip on runCount)    │
│  • Run tab        (row/strategy selection, cost preview,    │
│                    repeat count, overflow warnings,          │
│                    confirmation dialog, cancel button)       │
│  • Results tab    (summary view + detail table with         │
│                    ground truth + per-strategy columns,     │
│                    stddev badges, reasoning drill-down)     │
│                                                              │
│  Storage: localStorage via EvalStore (same interface, new   │
│  keys/shapes)                                                │
└────────────────┬─────────────────────────────────────────────┘
                 │  runStrategy(strategy, row) server action
                 │  called in a sequential loop with              
                 │  runIndex 0..repeatCount-1                     
                 ▼
┌──────────────────────────────────────────────────────────────┐
│  Server action (src/ai/eval/run-strategy.ts)                │
│  ──────────────────────────────────                          │
│  • Builds short compatibility prompt from promptVariant     │
│  • Calls OpenRouter                                          │
│  • Parses {score, reasoning} JSON                            │
│  • Validates score in 0-100, reasoning non-empty            │
│  • Measures latency, calculates cost                        │
│  • Returns RunResult                                         │
└──────────────────────────────────────────────────────────────┘
```

### File layout (changes from v1)

| File | Change |
|---|---|
| `src/lib/eval/types.ts` | **Rewritten**: `EvalRow`, `StrategyOutput`, updated `RunResult`, `RunMetrics`. Old types deleted. |
| `src/lib/eval/store.ts` | **Updated**: rename methods (`getRows` etc), add cascade delete, add v1 data detection + wipe |
| `src/lib/eval/metrics.ts` | **Rewritten**: `scoreRunResult`, `aggregateMetrics`. Spearman and `compareToLabels` deleted. |
| `src/lib/eval/prompts.ts` | **Rewritten**: short `default` + `simplified` variants for pairwise scoring |
| `src/lib/eval/seed-data.ts` | **Rewritten**: 4 `EvalRow`s, 4 strategies (Sonnet ID fixed) |
| `src/lib/eval/model-prices.ts` | **Extended**: add `contextWindow` field, add `estimateTokens` helper |
| `src/lib/eval/plan-sweep.ts` | **NEW**: `planSweep()` pure function — returns runnable combinations + skipped list + cost estimate |
| `src/ai/eval/run-strategy.ts` | **Updated**: new input/output shape, simpler validation |
| `src/ai/eval/openrouter-client.ts` | Unchanged |
| `src/app/eval/page.tsx` | **Heavily updated**: all four tabs change |
| `src/lib/eval/metrics.test.ts` | **Rewritten** |
| `src/lib/eval/store.test.ts` | **Rewritten** |
| `src/lib/eval/prompts.test.ts` | **Rewritten** |
| `src/lib/eval/plan-sweep.test.ts` | **NEW** |
| `src/ai/eval/run-strategy.test.ts` | **Updated** for new shape |

**Unchanged** outside of worktree boundary: production code (`src/ai/flows/find-matches-flow.ts`, `src/ai/genkit.ts`, `src/app/matches/page.tsx`) and everything not under `src/lib/eval/`, `src/ai/eval/`, `src/app/eval/`.

## Components

### `types.ts`

```ts
// --- Core row (the thing we evaluate) ---

export interface EvalRow {
  id: string;
  label: string;                    // short name, e.g. "High match: aligned introverts"
  profileA: string;                 // free-form text description of person A
  profileB: string;                 // free-form text description of person B
  expected: {
    score: number;                  // 0-100, human ground truth
    reasoning: string;              // why you think so
  };
  tags: string[];                   // for filtering
}

// --- What a strategy returns for one row ---

export interface StrategyOutput {
  score: number;                    // 0-100
  reasoning: string;                // model's explanation
}

// --- Strategy: unchanged, but runCount is documented differently ---

export type PromptVariant = 'default' | 'simplified';

export interface Strategy {
  id: string;
  name: string;
  model: string;                    // OpenRouter model ID
  promptVariant: PromptVariant;
  runCount: number;                 // Internal algorithm call count (for median-of-N strategies, v2.1+).
                                    // NOT the same as sweep-level repeat runs.
}

// --- Run result (one invocation of a strategy on a row) ---

export interface RunResult {
  id: string;                       // unique
  strategyId: string;
  rowId: string;                    // was pairId in v1
  runIndex: number;                 // 0..repeatCount-1 for repeat runs (always 0 when repeatCount=1)
  timestamp: string;                // ISO 8601 — lexicographically sortable without Date parsing
  output: StrategyOutput | null;    // null if error
  rawOutput?: string;               // raw LLM string — useful when JSON parsing fails
  metrics: RunMetrics | null;       // null if error
  error?: string;
}

// --- Metrics for ONE run ---

export interface RunMetrics {
  scoreDelta: number;               // abs(output.score - expected.score)
  reasoningLength: number;          // output.reasoning.trim().length
  hasSubstantiveReasoning: boolean; // reasoningLength >= SUBSTANTIVE_REASONING_MIN (= 50)
  costUsd: number | null;           // null if model not in price table
  latencyMs: number;
}

// --- Aggregated metrics across N runs (Concept B repeat runs) ---

export interface AggregatedMetrics {
  avgScoreDelta: number;
  scoreStdDev: number;              // stddev of raw output.score values (reliability signal). 0 when runCount=1.
  avgReasoningLength: number;
  substantiveReasoningRate: number; // fraction of runs with hasSubstantiveReasoning = true
  avgCostUsd: number | null;
  avgLatencyMs: number;
  runCount: number;
}

// --- Sweep config (new — built from Run tab) ---

export interface SweepConfig {
  selectedRowIds: string[];
  selectedStrategyIds: string[];
  repeatCount: number;              // 1 = no repetition
  tagFilter?: string[];             // rows must have at least one of these tags; undefined = no filter
}

// --- Typed errors ---

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

### `model-prices.ts`

```ts
export interface ModelPrice {
  inputPerM: number;
  outputPerM: number;
  contextWindow: number;            // total token budget for the model
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
): number | null;

// Rough pre-run token estimate. ~4 chars per token for English.
export function estimateTokens(text: string): number;
```

Verify model IDs + context windows against OpenRouter docs at implementation time. If `anthropic/claude-sonnet-4` turns out unavailable, fallback is `anthropic/claude-3.5-haiku`.

### `metrics.ts` (rewritten — much smaller)

```ts
// Threshold constant — tunable.
export const SUBSTANTIVE_REASONING_MIN = 50;

// Validate + metric one run output against ground truth.
// Throws MetricsInvariantError if score is out of 0-100 range or reasoning is empty.
export function scoreRunResult(
  output: StrategyOutput,
  expected: EvalRow['expected'],
): Omit<RunMetrics, 'costUsd' | 'latencyMs'>;

// Aggregate metrics across N successful runs (for the same {strategy, row} group).
// Requires metricsList.length > 0. Computes population stddev of raw scores.
export function aggregateMetrics(
  results: RunResult[],                // only the successful ones (metrics != null)
): AggregatedMetrics;
```

~40 LOC total. No more Spearman, no more `compareToLabels`, no deal-breaker logic.

### `prompts.ts` (rewritten)

```ts
import type { EvalRow, PromptVariant } from './types';

export interface PromptInput {
  profileA: string;
  profileB: string;
}

export const promptVariants: Record<PromptVariant, (input: PromptInput) => string> = {
  default: buildDefaultPrompt,
  simplified: buildSimplifiedPrompt,
};

// Helper to build a PromptInput from an EvalRow (drops other fields).
export function promptInputFromRow(row: EvalRow): PromptInput {
  return { profileA: row.profileA, profileB: row.profileB };
}
```

**Default prompt**:

```
You are an expert relationship psychologist.

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
}
```

**Simplified prompt**:

```
Score 0-100 how compatible these two people are.

A: ${profileA}
B: ${profileB}

JSON: {"score": N, "reasoning": "text"}
```

### `seed-data.ts` (rewritten)

4 `EvalRow`s:

1. `r1-high-match` — "High match: aligned introverts" — Alex (quiet writer+climber, secure) + Sam (warm therapist, secure) → expected 90
2. `r2-deal-breaker` — "Deal-breaker: anxious + avoidant" — Jordan (anxious, needs reassurance) + Riley (avoidant, values independence) → expected 10
3. `r3-medium` — "Medium match: partial overlap" — Taylor (outdoorsy spontaneous) + Morgan (introvert who likes hiking) → expected 65
4. `r4-asymmetric` — "Asymmetric: one-sided attraction" — Avery (loud party lover) + Quinn (calm intellectual who dislikes chaos) → expected 35

Each row has tags for filtering (e.g. `["high-match", "secure-secure"]`).

4 seeded strategies, with Sonnet bug fixed:

| Strategy ID | Model |
|---|---|
| `gemini-flash-default` | `google/gemini-2.5-flash` |
| `claude-sonnet-4` | `anthropic/claude-sonnet-4` *(fix: was `anthropic/claude-3.5-sonnet` — 404 on OpenRouter)* |
| `gpt-4o-mini-default` | `openai/gpt-4o-mini` |
| `llama-3-8b-budget` | `meta-llama/llama-3-8b-instruct` |

### `plan-sweep.ts` (new pure-function module)

```ts
export interface OverflowWarning {
  rowId: string;
  strategyId: string;
  estimatedTokens: number;
  contextWindow: number;
}

export interface SweepPlan {
  runnable: Array<{ row: EvalRow; strategy: Strategy; runIndex: number }>;
  skipped: OverflowWarning[];
  estimatedUsd: number;
  unknownModelCount: number;        // count of runnable combos with no price
  estimatedSeconds: number;         // runnable.length * 2
  runCount: number;                 // == runnable.length
}

// Pure. No I/O. Deterministic.
export function planSweep(
  rows: EvalRow[],
  strategies: Strategy[],
  repeatCount: number,
): SweepPlan;
```

Checks: `estimateTokens(renderedPrompt) + 500 (completion reserve) <= modelPrices[strategy.model].contextWindow`. Combinations that fail are moved to `skipped`.

### `store.ts` (updated)

`EvalStore` interface:

```ts
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
```

`LocalStorageEvalStore` implementation:

- Keys: `eval.rows`, `eval.strategies`, `eval.results`
- On first read, check for v1-shaped data (presence of `eval.pairs` OR presence of `candidateId`/`targetUserId`/`unidirectionalScore` in any stored object). If detected, wipe all three keys and re-seed from `seedRows` + `seedStrategies`.
- SSR-safe guards (unchanged from v1)
- Cascade delete: `deleteResultsForRow`/`deleteResultsForStrategy` filter `eval.results` in place.

### `run-strategy.ts` (updated)

```ts
'use server';

export async function runStrategy(
  strategy: Strategy,
  row: EvalRow,
  runIndex: number = 0,
): Promise<RunResult>;
```

Flow:
1. Build prompt via `promptVariants[strategy.promptVariant](promptInputFromRow(row))`
2. Start timer
3. Call `callOpenRouter({ model, messages, wantsJson: true })`
4. Stop timer → `latencyMs`
5. Strip code fences; `JSON.parse`
6. Validate: shape is `{score: number, reasoning: string}`, score in 0-100, reasoning non-empty
7. Call `scoreRunResult(output, row.expected)` → quality metrics
8. Calculate `costUsd` from token counts
9. Return `RunResult` with `runIndex` stamped in

Never throws — all errors return a `RunResult` with `error` field.

### `page.tsx` (heavily updated)

Single `/eval` page, same 4-tab shell as v1, new content per tab. Broken into section 3 earlier — full detail in the "UI details" section below.

## UI details

### Dataset tab

- **Toolbar**: `[+ New Row]` button, tag filter dropdown (multi-select), search box (matches label text).
- **Row list**: cards, one per row. Each card shows label, tags as chips, truncated profile A/B (3 lines each), expected score as a large number, expected reasoning as gray italic text. Edit + Delete buttons in the card header.
- **Click card**: opens Row Detail dialog.

**Row Detail dialog**:
- Tags row with `[+ add tag]` chip input
- Profile A textarea (full content, editable)
- Profile B textarea (full content, editable)
- Expected score number input (0-100)
- Expected reasoning textarea
- Prompt preview section: variant selector (`default` / `simplified`), renders the prompt that would be sent for this row. **Read-only in v2.0.** Editing prompts from the UI is deferred to v2.1.
- Buttons: `[Cancel]` `[Delete]` `[Save]`

**New row flow**: `[+ New Row]` opens the same dialog with empty fields.

**Undo delete**: clicking Delete on a card or in the dialog removes the row from React state immediately, shows a 6-second toast *"Deleted 'Row X'. [Undo]"*, and defers the `store.deleteRow()` call until the timer fires. If Undo is clicked, the state is restored and the store is never touched. On timeout, the store delete fires plus `deleteResultsForRow(rowId)` to cascade.

### Strategies tab

Mostly unchanged from v1. Two small additions:

- Tooltip `?` next to the "Run count" input in the edit dialog: *"Advanced: how many internal LLM calls the strategy's algorithm makes (e.g. 'median of 3'). Keep at 1 unless you're using a median-of-N strategy. For repeating the whole evaluation N times, use 'Repeat runs' on the Run tab."*
- Undo delete on strategy delete (same mechanism as rows).

### Run tab

**Layout**:

```
┌─ Run configuration ─────────────────────────────────────────┐
│ Rows (4 selected / 4 total)          [Select all] [None]    │
│   ☑ High match: aligned introverts   [tag: high-match]      │
│   ☑ Deal-breaker: anxious + avoidant [tag: deal-breaker]    │
│   ☑ Medium match: partial overlap                           │
│   ☑ Asymmetric: one-sided attraction                        │
│                                                             │
│ Strategies (4 selected / 4 total)    [Select all] [None]    │
│   ☑ Gemini 2.5 Flash                                        │
│   ☑ Claude Sonnet 4                                         │
│   ☑ GPT-4o mini                                             │
│   ☑ Llama 3 8B                                              │
│                                                             │
│ Repeat runs: [1] ×                                          │
│   (each combination runs N times for reliability)           │
│                                                             │
│ Tag filter: [all tags ▼]                                    │
│                                                             │
│ ─────────────────────────────                               │
│ Total runs:     16                                          │
│ Estimated cost: ~$0.042 ($0.28 per 1000 calls)              │
│ Estimated time: ~32s                                        │
│ Skipped:        0 (context window overflow)                 │
│                                                             │
│                              [ Run selected ]               │
└─────────────────────────────────────────────────────────────┘
```

When Run is clicked:

1. `planSweep(...)` runs → produces `runnable[]` + `skipped[]`
2. If `runnable.length === 0` → error toast, don't proceed
3. Otherwise → confirmation dialog

**Confirmation dialog**:

```
┌─ Confirm run ─────────────────────────────────────────────┐
│ About to run 12 evaluations (4 skipped).                  │
│ Estimated cost: ~$0.028 ($2.30 per 1000 calls)            │
│ Estimated time: ~24s                                      │
│                                                            │
│ ⚠ 4 combinations skipped — input exceeds context window: │
│   • Llama 3 8B × "High match..."      (est 12k / limit 8k)│
│   • ... (truncated after 5; full list in Results banner)  │
│                                                            │
│ ⚠ Large sweep: 50+ runs. Sequential, will take ~Xm.      │
│   You can use other tabs while it runs, or cancel any    │
│   time via the "Stop" button on the Run tab.             │
│                                                            │
│                       [Cancel]  [Run 12 remaining]        │
└────────────────────────────────────────────────────────────┘
```

- Skip warning appears whenever `skipped.length > 0`.
- Large-sweep warning appears when `runnable.length >= 50` (constant `LARGE_SWEEP_THRESHOLD`).
- Run button is disabled if `runnable.length === 0`.

**Running state**:
- Progress bar showing current run / total
- Text label: `Running Claude Sonnet 4 on "High match..." (3/12, run 1/1)`
- Red `[ Stop ]` button — sets `cancelled = true` in a ref, the loop checks after each `saveResult`
- Progress updates as each `RunResult` is saved; Results tab updates live in the background

**After completion**:
- Progress shows `Done (12/12)` or `Cancelled (7/12 complete)`
- If skipped > 0, Results tab shows a banner: *"Last sweep skipped N combinations due to context limits. See details."* with a button that opens the skip list.

### Results tab

**Two views toggled by a segmented control at the top**:

**View 1 — Summary** (same as v1, per-strategy aggregates). Columns:
- Strategy name
- Runs count
- Avg Δ score (lower is better)
- Explainability (substantive reasoning rate as a percentage)
- Avg cost per call
- Cost per 1000 calls (new)
- Avg latency
- Failed count (red badge if > 0)

Sorted by Avg Δ ascending (best quality first). Failed-runs section below the table, unchanged from v1.

**View 2 — Detail** (new, item 9):

```
Row                   │ Truth │ Gemini      │ Claude       │ GPT-4o      │ Llama
──────────────────────┼───────┼─────────────┼──────────────┼─────────────┼──────────
High match intros     │  90   │  88         │  92          │  85         │  78
Deal-breaker anx+avd  │  10   │  5          │  12          │  15         │  25 ⚠
Medium partial        │  65   │  70         │  63          │  62         │  55
Asymmetric            │  35   │  40         │  38          │  45         │  50
──────────────────────┼───────┼─────────────┼──────────────┼─────────────┼──────────
Avg Δ                 │       │  4.5        │  2.5         │  5.0        │ 13.8
Explainability        │       │  100%       │  100%        │  100%       │  50% ⚠
```

- Leftmost column is row label. "Truth" column shows the expected score. Each model column shows its output score.
- If `repeatCount > 1`, cells show `mean ±stddev` (e.g. `52 ±3` or `52 ±34 ⚠`). A toggle at the top lets the user switch to comma-separated raw scores (`[50, 52, 54]`).
- Clicking a row label → navigates to Dataset tab and scrolls/highlights that row (via URL hash, see Data Flow section).
- Clicking a column header (strategy name) → same for Strategies tab.
- Clicking a cell → dialog with full reasoning text for each run in that cell.
- Warning icons ⚠:
  - On a cell: `scoreDelta > 20` or `scoreStdDev > 15`
  - On a column footer (explainability row): `substantiveReasoningRate < 0.8`

**Empty state** (no results yet): "No results yet. Go to the Run tab to start an eval."

### Cross-cutting polish

- **Cost display format**: everywhere cost is shown, show both per-call and per-1000-calls (`$0.0003 / $0.30 per 1k`). The per-1000 format is easier to reason about for cheap models.
- **Linked items** (item 10): clicking a row or column in the Results detail table navigates to the corresponding tab and highlights/scrolls the item. Implementation: `window.location.hash = '#row-{id}'` or `#strategy-{id}` + tab switch. The target tab listens for `hashchange` and scrolls + highlights for 2 seconds.
- **Undo delete**: uniform toast-with-undo pattern across rows and strategies. 6-second timeout. State-only undo — the store operation is deferred.
- **Error banner for missing `OPENROUTER_API_KEY`**: unchanged from v1. Persistent red banner at the top of the page; Run button disabled.

## Data flow

### Initial load

1. `page.tsx` mounts → constructs `LocalStorageEvalStore` inside `useEffect` (SSR-safe)
2. Store reads `eval.rows`, `eval.strategies`, `eval.results` from localStorage
3. **v1 detection**: if any of the keys contain v1-shaped data (e.g. objects with `candidateId` or `targetUserId`), wipe all three keys and re-seed from `seedRows`/`seedStrategies`. Show a toast: *"Eval framework upgraded to v2 — previous data was reset."*
4. **Empty detection**: if `eval.rows` or `eval.strategies` is missing, seed from defaults (same as v1 behavior)
5. React state populates from store, UI renders

### Running a sweep

1. User configures Run tab (selects rows/strategies, sets repeatCount, optional tag filter)
2. User clicks `[Run selected]`
3. `planSweep(selectedRows, selectedStrategies, repeatCount)` → `SweepPlan { runnable, skipped, estimatedUsd, estimatedSeconds }`
4. Confirmation dialog shown with plan details + warnings
5. User clicks `[Run 12 remaining]`
6. `runnable[]` becomes a sequential queue
7. Loop (checking `cancelledRef.current` between iterations):
   ```
   for (const item of runnable) {
     if (cancelledRef.current) break;
     setProgress(`Running ${item.strategy.name} on "${item.row.label}" (${i}/${total}, run ${item.runIndex+1}/${repeatCount})`);
     const result = await runStrategy(item.strategy, item.row, item.runIndex);
     await store.saveResult(result);
     setResults(await store.getResults());  // triggers Results tab re-render
     i++;
   }
   ```
8. When done (or cancelled), set final progress text; re-enable the Run button
9. If `skipped.length > 0`, remember it in a ref so the Results tab banner can show it

### Viewing results (detail view)

1. Results tab reads `results` state
2. Groups by `{rowId, strategyId}` — produces a map `Map<string, RunResult[]>`
3. For each group:
   - If `group.length === 1` → display the single score
   - If `group.length > 1` → call `aggregateMetrics(group)` → display `mean ±stddev`
4. Derived on every render — no explicit recomputation caching (React re-renders are fine for 4 rows × 4 strategies × maybe 3 repeats = 48 cells)

### Editing a row

1. User clicks a row card → dialog opens with current values in a `draft` local state
2. User edits fields (React state updates locally)
3. User clicks Save → `store.saveRow(draft)` → `setRows(await store.getRows())` → dialog closes
4. Any existing `RunResult`s for this row are now stale (different expected values). They remain in the store but the Results tab shows a small "stale" badge next to them. Next sweep overwrites.

### Deleting (with undo)

1. User clicks Delete on a row
2. Row removed from React state immediately
3. Pending delete stored in a ref: `{ item: row, timer: setTimeout(commit, 6000) }`
4. Toast: `"Deleted 'High match...'. [Undo]"` for 6s
5. If Undo clicked before timeout: `clearTimeout`, put row back in state, store is never touched
6. On timeout: `store.deleteRow(row.id)` + `store.deleteResultsForRow(row.id)` fires, pending-delete ref cleared

Same flow for strategies (with `deleteResultsForStrategy`).

### Linked items navigation

1. User clicks row label in Results detail table
2. Handler sets `window.location.hash = '#row-r1-high-match'`
3. Handler calls `setActiveTab('dataset')`
4. Dataset tab's `useEffect` listens for `hashchange`: if hash matches `#row-{id}`, find the row, scroll it into view, apply a `.highlighted` CSS class for 2 seconds
5. Works the same for strategies with `#strategy-{id}` → Strategies tab

## Error handling

| Error | Where caught | Behavior |
|---|---|---|
| Missing `OPENROUTER_API_KEY` | `openrouter-client.ts` | Throws `EvalConfigError`. UI shows persistent red banner; Run button disabled. |
| Context window overflow | `planSweep` (pre-run, pure check) | Combination moved to `skipped` list. Never reaches `runStrategy`. Listed in confirmation dialog and results banner. |
| OpenRouter HTTP error | `run-strategy.ts` catches | `RunResult` with `error` field, `metrics: null`. Sweep continues. Red failed badge in Results. |
| Malformed JSON | `run-strategy.ts` via try/catch on `JSON.parse` | `RunResult` with error + `rawOutput` preserved for debugging. |
| Empty content | Same path | Distinct message: `"LLM returned empty content"`. |
| Score out of range (0-100) | `scoreRunResult` throws `MetricsInvariantError` | Caught in `run-strategy.ts`, returned as `RunResult` with error. |
| Empty reasoning | `scoreRunResult` throws `MetricsInvariantError` | Same as score out of range. |
| Short (but non-empty) reasoning | **Not an error** | Sets `hasSubstantiveReasoning = false`. This is a quality signal; the aggregate shows an explainability warning but the run succeeds. |
| `localStorage` full | `LocalStorageEvalStore.saveResult` | Throws `EvalStorageFullError`. Toast + "Clear old results" prompt. |
| User clicks Stop mid-sweep | Sweep loop checks `cancelledRef.current` between runs | In-flight LLM call completes; no new calls start. Progress: `"Cancelled (7/12 complete)"`. |

**Explicitly not done**:
- No retry logic (MVP runs once, user can re-click if needed)
- No fallback to stale data
- No empty `catch {}` blocks
- No global error boundary swallowing errors
- No "auto-shorten profiles to fit context" — too magical; we just skip and tell the user

## Testing

### New unit tests

| File | Key tests | Why |
|---|---|---|
| `metrics.test.ts` (rewritten) | `scoreRunResult`: perfect match → delta 0; reasoning length computed; threshold boundary at exactly 50; throws on score < 0; throws on score > 100; throws on empty reasoning. `aggregateMetrics`: single-result case → stddev 0; multi-result case on known dataset → expected stddev; substantive reasoning rate fraction; empty list throws. | Core math must be right. |
| `store.test.ts` (rewritten) | Round-trip rows/strategies/results. Cascade delete: `deleteResultsForRow` removes only matching. **v1 detection**: given a localStorage with v1-shaped data (contains `candidateId`), store wipes and re-seeds. SSR-safe guards. | Data layer reliability + v1 migration. |
| `prompts.test.ts` (rewritten) | Snapshot test for `default` variant against a fixed fixture. Snapshot test for `simplified`. Assertion: `simplified` shorter than `default`. | Catches accidental prompt drift. |
| `plan-sweep.test.ts` (new) | No overflow case. Partial overflow: some skipped, rest runnable. All-overflow: `runnable` empty, `skipped` has every combination. Unknown model (no `contextWindow`): included in `runnable`, counts in `unknownModelCount`. `repeatCount` multiplier applied. Empty selection → empty plan. | Pre-run planning is new; enough branches to test. |
| `run-strategy.test.ts` (updated) | Happy path, malformed JSON, empty content, score out of range, OpenRouter throws, cost calculation. Adapted to new `{score, reasoning}` shape. | Integration with mocked OpenRouter. |

### Not tested — manual verification instead

- `openrouter-client.ts` — thin HTTP wrapper
- `page.tsx` — UI glue; manual checklist below
- Seed data, price table — no logic
- Undo delete timing — integration-sensitive, in manual checklist

### Manual test checklist

1. `/eval` loads with 4 seeded rows and 4 seeded strategies (Sonnet strategy uses the new model ID)
2. Upgrading from v1: if you have v1 localStorage data, it wipes and re-seeds with a one-time toast
3. Editing a row's profileA/profileB/expected persists on reload
4. Tag filter narrows the row list on the Dataset tab
5. Selecting a subset on the Run tab updates estimated cost + time
6. Sweep with `repeatCount = 3` produces 3 `RunResult`s per `{row, strategy}` combination
7. Results detail view shows `mean ±stddev` when `repeatCount > 1`; stddev > 15 shows ⚠
8. Adding a 50k-char profile triggers overflow check: Llama 8B combinations skipped with a warning in the confirmation dialog
9. Large-sweep warning (≥50 runs) shown in confirmation dialog
10. Cancel button stops a running sweep cleanly; remaining runs never fire
11. Undo delete restores a row within 6s; waiting 6s persists the delete and cascades results
12. Clicking a row name in Results detail → Dataset tab opens, row scrolled into view + highlighted for 2s
13. Clicking a strategy name in Results detail → Strategies tab equivalent
14. Sonnet strategy actually runs without the v1 404 error (requires real `OPENROUTER_API_KEY`)

## Environment setup

No new env vars beyond `OPENROUTER_API_KEY`. The `.env.example` from v1 is unchanged.

## Success criteria

v2.0 is done when:

1. `/eval` page loads with 4 seeded text-based rows and 4 seeded strategies
2. Clicking a row opens a detail dialog showing the full profile A + profile B text + expected score + prompt preview
3. Run tab lets you select a subset, see estimated cost + time + overflow warnings, and confirm before running
4. Repeat runs (repeatCount > 1) produces N `RunResult`s per combination; Results detail view shows `mean ±stddev`
5. Results detail table shows ground truth column + per-strategy columns; linked navigation works
6. Undo delete works on rows and strategies
7. Sonnet strategy runs successfully against the new model ID (manual check with real key)
8. Context window overflow is detected and skipped before running; listed in the confirmation dialog
9. `npm run test` passes all unit tests
10. `npm run typecheck` passes with 0 errors
11. v1 localStorage data on an existing user's machine is auto-wiped and re-seeded with a one-time toast

## Explicitly deferred to v2.1 or later

- Median-of-N strategy **algorithm implementation** (data model already supports it via `runCount`; the wrapper that calls the LLM N times inside one strategy is not built)
- Editing prompt variants from the UI (v2.0 shows read-only preview; to edit, you edit `src/lib/eval/prompts.ts` directly)
- LLM-as-judge as a secondary quality signal
- Dataset import/export
- Supabase persistence (the `EvalStore` interface is still the swap point)
- "Shorten profile automatically to fit context window" helper
