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
