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
