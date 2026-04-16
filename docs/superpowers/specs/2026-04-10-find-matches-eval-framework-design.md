# Find-Matches Eval Framework — Design

**Date**: 2026-04-10
**Branch**: `ai-eval-framework`
**Status**: Design approved, ready for implementation plan

## Goal

Build an internal evaluation framework for the `findMatches` AI flow so we can compare different LLMs, prompt variants, and matching strategies on a single axis of "quality vs. cost vs. latency" — and answer "which option is best and most cost-effective?" with data instead of guesswork.

## Non-Goals

- Not a production feature. Lives behind `/eval` as an internal tool.
- Not replacing the current `findMatches` flow. The production path stays on Genkit + Gemini 2.5 Flash, unchanged.
- Not a general-purpose eval platform (no dataset versioning, no CI integration, no LLM-as-judge pipeline in MVP).
- Not a backend. All data lives in browser `localStorage` until a later Supabase migration.

## Context

The project has a single AI flow at `src/ai/flows/find-matches-flow.ts` that scores compatibility between a user and a list of candidates using a complex prompt (scoring rubric, attachment-style matrix, deal-breaker rules). It currently uses `googleai/gemini-2.5-flash` via Genkit. There is no way to compare alternative models, alternative prompts, or alternative algorithms (e.g. "run 3 times and take the median"). This framework fills that gap.

## User-approved decisions

| Decision | Choice | Rationale |
|---|---|---|
| Quality signal | Human-labeled ground truth | User wants gold standard; synthetic judgement not trusted for subjective matching |
| Dataset size | 4 pairs to start | MVP scope; fake scores seeded for UI testing; user will relabel after seeing UI |
| Dataset source | Hardcoded fake profiles (MVP), Supabase (future) | No Firestore. Browser-only until Supabase migration |
| What to compare | Providers, prompt variants, algorithms (future) | Strategy is a black box: `(input) → output`. Enables "median of 3" as a strategy |
| Providers | OpenRouter (covers Gemini, Claude, GPT, others via one API) | Single adapter, single key |
| Metrics tracked | Quality, cost USD, latency ms | "Cost-effective" was in the original goal |
| UI shape | Single-page dashboard at `/eval`, 4 tabs | Minimal complexity for MVP scope |
| Data persistence | `localStorage` via `EvalStore` interface | Swappable for Supabase later without touching UI |
| LLM calls | Next.js server action | Keeps `OPENROUTER_API_KEY` off the client |
| Existing code | Untouched | Production `findMatches` path stays on Genkit |

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Browser  (src/app/eval/page.tsx)                       │
│  ─────────────────────────────────                      │
│  • Dataset tab    (view/edit pairs + labels)            │
│  • Strategies tab (list of model+prompt combos)         │
│  • Run tab        (button → call server action)         │
│  • Results tab    (comparison table)                    │
│                                                          │
│  Storage: localStorage via EvalStore interface          │
│  (swappable for Supabase later)                         │
└────────────────┬────────────────────────────────────────┘
                 │  calls server action with {strategy, pair}
                 ▼
┌─────────────────────────────────────────────────────────┐
│  Server action (src/ai/eval/run-strategy.ts)            │
│  ─────────────────────────────────                      │
│  • Builds prompt from promptVariant                     │
│  • Calls OpenRouter with model from strategy            │
│  • Measures latency, calculates cost                    │
│  • Validates output with Zod                            │
│  • Returns { output, costUsd, latencyMs, metrics }      │
└─────────────────────────────────────────────────────────┘
```

### File layout

| File | Purpose |
|---|---|
| `src/lib/eval/types.ts` | Shared types: `EvalProfile`, `EvalPair`, `Strategy`, `RunResult` |
| `src/lib/eval/store.ts` | `EvalStore` interface + `LocalStorageEvalStore` implementation |
| `src/lib/eval/metrics.ts` | Pure functions: `compareToLabels`, `spearman` |
| `src/lib/eval/prompts.ts` | Registry of prompt variants: `default`, `simplified` |
| `src/lib/eval/seed-data.ts` | 4 hardcoded fake pairs + fake expected scores |
| `src/lib/eval/model-prices.ts` | Price table: OpenRouter model ID → `{inputPerM, outputPerM}` |
| `src/ai/eval/openrouter-client.ts` | Thin OpenRouter REST wrapper (server-only) |
| `src/ai/eval/run-strategy.ts` | Server action: runs one strategy against one pair |
| `src/app/eval/page.tsx` | The single-page dashboard (UI only) |
| `src/lib/eval/metrics.test.ts` | Unit tests for metrics |
| `src/lib/eval/store.test.ts` | Unit tests for store |
| `src/lib/eval/prompts.test.ts` | Snapshot test for default prompt variant |
| `src/ai/eval/run-strategy.test.ts` | Integration test with mocked OpenRouter |

**Unchanged existing files**: `src/ai/flows/find-matches-flow.ts`, `src/ai/genkit.ts`, `src/app/matches/page.tsx`.

**Modified existing files**: `.env.example` (add `OPENROUTER_API_KEY`), `package.json` (add `vitest`, `test` script).

## Components

### `types.ts`

```ts
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
}

export interface EvalPair {
  id: string;
  label: string;                    // human-readable, e.g. "Anxious + Avoidant mismatch"
  currentUser: EvalProfile;
  candidates: EvalProfile[];
  expected: Array<{
    candidateId: string;
    expectedFinalScore: number;     // 0-100
    expectedReasoning: string;
    shouldTriggerDealBreaker?: boolean;
  }>;
}

export interface Strategy {
  id: string;                        // "gemini-flash-default"
  name: string;                      // display name
  model: string;                     // OpenRouter model ID, e.g. "google/gemini-2.5-flash"
  promptVariant: 'default' | 'simplified';
  runCount: number;                  // MVP: always 1. Future: N for median-of-N
}

export interface RunResult {
  id: string;
  strategyId: string;
  pairId: string;
  timestamp: string;
  output: FindMatchesOutput | null;  // null if error
  rawOutput?: string;                // raw LLM string for debugging
  metrics: {
    scoreDeltaAvg: number;           // avg |output - label|
    rankingCorrelation: number;      // Spearman, -1 to 1
    dealBreakerAgreement: number;    // 0 to 1
    costUsd: number | null;          // null if model not in price table
    latencyMs: number;
  } | null;                          // null if error
  error?: string;
}
```

### `store.ts`

```ts
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
```

`LocalStorageEvalStore` uses three keys: `eval.pairs`, `eval.strategies`, `eval.results`. On first load, if any key is empty, it seeds defaults from `seed-data.ts`: 4 pairs + 4 strategies. The seeded strategies are:

| Strategy ID | Display name | Model (OpenRouter) | Prompt variant | Run count |
|---|---|---|---|---|
| `gemini-flash-default` | Gemini 2.5 Flash (default) | `google/gemini-2.5-flash` | `default` | 1 |
| `claude-sonnet-default` | Claude 3.5 Sonnet (default) | `anthropic/claude-3.5-sonnet` | `default` | 1 |
| `gpt-4o-mini-default` | GPT-4o mini (default) | `openai/gpt-4o-mini` | `default` | 1 |
| `llama-3-8b-budget` | Llama 3 8B (budget) | `meta-llama/llama-3-8b-instruct` | `default` | 1 |

All four seeded model IDs are keys in the `modelPrices` table so cost calculation works out of the box. The llama strategy acts as a low-cost open-source baseline: if it performs acceptably, it may be the cost-effective winner; if it fails (e.g. can't follow the complex rubric), that's itself a useful data point.

**SSR safety**: `LocalStorageEvalStore` must never touch `localStorage` during SSR (Next.js would crash with `ReferenceError: localStorage is not defined`). The store methods all guard with `if (typeof window === 'undefined') return <empty default>`, and `page.tsx` fetches data inside a `useEffect` after mount, not during render.

Catches `QuotaExceededError` on `saveResult` and rethrows as a friendly `EvalStorageFullError`.

### `metrics.ts`

Pure functions, no I/O, no state.

```ts
export function compareToLabels(
  output: FindMatchesOutput,
  expected: EvalPair['expected']
): {
  scoreDeltaAvg: number;
  rankingCorrelation: number;
  dealBreakerAgreement: number;
};

// Spearman rank correlation, O(n²), fine for N < 50
function spearman(a: number[], b: number[]): number;
```

**Invariants** (throws a typed `MetricsInvariantError` on violation):
- `output.matches` and `expected` must have the same set of candidate IDs
- `expected` must not be empty

The first invariant is a normal LLM failure mode (weak models may silently drop candidates), not a programming bug — `run-strategy.ts` catches the error, records the missing candidate IDs in the `error` string, and the UI surfaces it as "incomplete output" rather than a crash. This is how we discover that e.g. Llama 8B can't handle a 6-candidate batch without dropping some.

### `prompts.ts`

```ts
export type PromptVariant = 'default' | 'simplified';

export const promptVariants: Record<PromptVariant, (input: FindMatchesInput) => string> = {
  default: buildDefaultPrompt,    // same content as find-matches-flow.ts, ported from Handlebars to template literals
  simplified: buildSimplifiedPrompt, // a short version for baseline comparison
};
```

**Note on the `default` variant**: the current `find-matches-flow.ts` prompt uses Handlebars templating (`{{{currentUser.name}}}`, `{{#each}}`, etc.) via Genkit's `definePrompt`. The `default` variant is a port of that prompt into a plain TypeScript function using template literals — same text content, same structure, same rubric, just a different rendering mechanism. The snapshot test verifies the rendered output against a fixed input.

### `seed-data.ts`

4 hardcoded `EvalPair` objects covering:
1. **High match** — secure+secure, core values aligned
2. **Low match** — anxious+avoidant (should trigger deal-breaker → 0 score)
3. **Medium match** — partial tag overlap, different attachment styles
4. **Asymmetric match** — user loves match, match wouldn't love user back (tests reciprocity)

Each pair has 2-3 candidates and fake `expectedFinalScore` values. User will relabel after seeing the UI.

### `model-prices.ts`

```ts
export const modelPrices: Record<string, { inputPerM: number; outputPerM: number }> = {
  'google/gemini-2.5-flash': { inputPerM: 0.075, outputPerM: 0.30 },
  'anthropic/claude-3.5-sonnet': { inputPerM: 3.00, outputPerM: 15.00 },
  'openai/gpt-4o-mini': { inputPerM: 0.15, outputPerM: 0.60 },
  'meta-llama/llama-3-8b-instruct': { inputPerM: 0.05, outputPerM: 0.08 },
  // Extend as needed
};
```

Prices in USD per million tokens. If a model isn't in the table, `costUsd` returns `null` and the UI shows "unknown".

### `openrouter-client.ts` (server-only)

```ts
'use server';

export async function callOpenRouter(params: {
  model: string;
  messages: Array<{ role: 'system' | 'user'; content: string }>;
  responseSchema?: object;
}): Promise<{
  content: string;
  promptTokens: number;
  completionTokens: number;
}>;
```

Reads `OPENROUTER_API_KEY` from `process.env`. Throws `EvalConfigError` if missing. Uses OpenRouter's `/chat/completions` endpoint with JSON response format when `responseSchema` is provided.

### `run-strategy.ts` (server action)

```ts
'use server';

export async function runStrategy(
  strategy: Strategy,
  pair: EvalPair
): Promise<RunResult>;
```

Flow:
1. Build prompt via `promptVariants[strategy.promptVariant]`
2. Start timer
3. Call `callOpenRouter({ model: strategy.model, messages, responseSchema })`
4. Stop timer → `latencyMs`
5. Parse with `FindMatchesOutputSchema.safeParse(content)`
6. On parse failure → return `RunResult` with `error`, `rawOutput`, `metrics: null`
7. Calculate `costUsd` from token counts and `modelPrices`
8. Call `compareToLabels(output, pair.expected)` → `quality metrics`
9. Return `RunResult` with full metrics

### `page.tsx`

Single route `/eval`. Uses shadcn `Tabs` component with four tabs:

**Dataset tab**: Table of pairs. Click a row → edit dialog to change `expectedFinalScore` and `expectedReasoning`. "Reset to seed" button restores the original fake data.

**Strategies tab**: Table of strategies. "Add strategy" button opens a dialog with model picker (hardcoded list of common OpenRouter models) + prompt variant dropdown + run count input.

**Run tab**: "Run all strategies × all pairs" button. Shows per-run progress (`Running claude-sonnet on pair 2/4...`). Runs are sequential to respect rate limits.

**Results tab**: Comparison table sorted by quality (lowest `scoreDeltaAvg` first). Columns: Strategy, Quality (avg score delta), Ranking correlation, Deal-breaker agreement, Avg cost USD, Avg latency ms, Status. Failed runs show with a red badge; clicking opens a dialog with the raw LLM output and error. "Clear all results" button at the bottom.

## Data flow

### Initial load

1. User opens `/eval`
2. `page.tsx` calls `store.getPairs()`, `store.getStrategies()`, `store.getResults()`
3. If pairs or strategies are empty, store seeds defaults from `seed-data.ts`
4. UI renders with seeded data

### Running a sweep

1. User clicks "Run all strategies × all pairs"
2. `page.tsx` builds queue: `[{strategy, pair} × all combinations]` — for 3 strategies × 4 pairs = 12 runs
3. For each `{strategy, pair}` sequentially:
   - UI shows progress
   - Call `runStrategy(strategy, pair)` server action
   - Server builds prompt → calls OpenRouter → parses → computes metrics → returns `RunResult`
   - `store.saveResult(result)` — browser persists
   - UI updates Results tab in real time
4. When queue is empty, "Run all" button re-enables

### Editing a label

1. User edits a pair in the Dataset tab
2. `store.savePair(updatedPair)` — browser persists
3. Any existing results for that pair are flagged stale in the UI (badge)
4. Next run overwrites stale results

### Key properties

- **Sequential runs** — avoids rate limits; makes latency measurements predictable (12 runs × ~2s = ~24s total)
- **Resumable** — results save as each run completes; closing the tab mid-sweep doesn't lose prior results
- **Clean server action boundary** — browser only sends `{strategy, pair}`, receives `RunResult`. No API key, no OpenRouter SDK on the client.

## Error handling

Every error either surfaces to the UI with enough context to debug, or is an actionable setup error shown once. No silent swallowing.

| Error | Where handled | How |
|---|---|---|
| Missing `OPENROUTER_API_KEY` | `openrouter-client.ts` on first call | Throws `EvalConfigError`. UI shows persistent red banner and disables Run button until fixed. |
| OpenRouter API error (rate limit, 500, timeout) | `run-strategy.ts` | Catches, returns `RunResult` with `error` string and `metrics: null`. Sweep continues. UI shows red "failed" badge on that row. |
| Malformed LLM output | `run-strategy.ts` via `safeParse` | Returns `RunResult` with `error`, `rawOutput` (raw string for debugging), `metrics: null`. |
| Empty LLM content | Same as malformed | Error message distinguishes: `"LLM returned empty content"`. |
| Metrics computation error (invariant violation) | `run-strategy.ts` catches `compareToLabels` throw | Returns `RunResult` with `error`, `output` preserved for inspection, `metrics: null`. The common case here is the LLM omitting one of the candidates from its `matches` array — the error message identifies which candidate IDs are missing so you can see whether to tune the prompt or switch models. UI renders a red "incomplete output" badge and makes the missing candidate IDs visible in the details dialog. |
| `localStorage` full (`QuotaExceededError`) | `LocalStorageEvalStore.saveResult` | Rethrows as `EvalStorageFullError`. UI shows toast + prompts user to clear old results. |

**Explicitly not done**:
- No retry logic (MVP runs once, shows error, user re-clicks)
- No fallback to stale data (failed run = failed result, not "last known good")
- No empty `catch {}` blocks anywhere
- No global error boundary swallowing errors

## Testing

**New infrastructure**: add `vitest` as a dev dependency, add `test` and `test:watch` scripts to `package.json`. This is the project's first test runner.

**What is tested**:

| File | Type | Why |
|---|---|---|
| `metrics.test.ts` | Unit | Highest-value module. If metrics are wrong, every quality number lies. Tests: perfect match = 0 delta, reversed ranking = -1 correlation, tied rankings, `MetricsInvariantError` thrown when output drops a candidate, `MetricsInvariantError` thrown on empty expected. Write these **before** implementing the functions (TDD). |
| `store.test.ts` | Unit with mocked localStorage | Round-trip save/get, seeding on empty storage, `QuotaExceededError` handled. |
| `prompts.test.ts` | Snapshot | Renders `default` variant against a fixed input and snapshots it. Catches accidental drift if someone edits the variant later. |
| `run-strategy.test.ts` | Integration with mocked `callOpenRouter` | Happy path, malformed JSON, empty content, cost calculation. |

**What is NOT tested**:
- `openrouter-client.ts` — thin HTTP wrapper; testing it means testing `fetch`. Manual smoke test documented: one real call against `google/gemini-2.5-flash` during development.
- `page.tsx` — UI glue. Low-value, high-maintenance. Manual test checklist instead: page loads, edit persists on reload, run shows progress, results sort correctly, clear empties table.
- `types.ts`, `seed-data.ts`, `model-prices.ts` — no logic.

**Explicitly out of scope**: E2E tests (Playwright), coverage targets, CI integration.

## Environment setup

Add to `.env.example`:

```
# OpenRouter API key for eval framework (https://openrouter.ai/keys)
# Do NOT commit .env.local
OPENROUTER_API_KEY=
```

User will add the real key to `.env.local` and restart the dev server.

## Known issues noted but out of scope

- `src/ai/genkit.ts:7` has a hardcoded Google API key. This is a pre-existing security issue, separate from this project. Worth fixing in a dedicated branch.
- `src/app/matches/page.tsx:112-116` passes incomplete profile data to `findMatches` (only `id`, `name`, `summary` — missing `persona`, `ideal_partner`, `psychological_insights`). This means the production prompt is currently working with less data than it expects. Noted for future fix.

## Success criteria

The framework is done when:
1. You can open `/eval`, see 4 seeded pairs and 3 seeded strategies
2. You can click "Run all" and within ~30s see a sorted comparison table with quality, cost, and latency for each strategy
3. Failed runs show clearly with the raw LLM output available for debugging
4. Editing a pair's expected score persists on reload
5. `npm run test` passes all unit tests
6. `npm run typecheck` passes with 0 errors
7. Existing `/matches` page continues to work unchanged
