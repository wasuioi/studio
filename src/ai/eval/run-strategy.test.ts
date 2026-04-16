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
