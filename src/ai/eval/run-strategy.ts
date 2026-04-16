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
