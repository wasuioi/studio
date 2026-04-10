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
