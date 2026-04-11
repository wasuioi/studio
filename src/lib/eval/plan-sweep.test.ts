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
