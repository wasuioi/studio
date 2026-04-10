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
    });
  }
  const latencyMs = Date.now() - startTime;

  if (!callResult.content || callResult.content.trim() === '') {
    return baseResult(runId, strategy.id, pair.id, timestamp, {
      error: 'LLM returned empty content',
      rawOutput: callResult.content,
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
    });
  }

  if (!parsed || !Array.isArray(parsed.matches)) {
    return baseResult(runId, strategy.id, pair.id, timestamp, {
      error: 'LLM output missing "matches" array',
      rawOutput: callResult.content,
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
