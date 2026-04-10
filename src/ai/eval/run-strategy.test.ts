import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Strategy, EvalPair } from '@/lib/eval/types';

// Mock the openrouter-client module BEFORE importing run-strategy.
vi.mock('./openrouter-client', () => ({
  callOpenRouter: vi.fn(),
}));

// Mock server-only (it throws when imported from a test normally).
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

const pair: EvalPair = {
  id: 'p-test',
  label: 'test',
  currentUser: {
    id: 'u1',
    name: 'Alex',
    persona: { summary: 'Creative.', tags: ['creative'] },
    ideal_partner: { summary: 'Kind.', tags: ['kind'] },
    summary: 'u1',
  },
  candidates: [
    {
      id: 'c1',
      name: 'Sam',
      persona: { summary: 'Warm.', tags: ['kind'] },
      ideal_partner: { summary: 'Creative.', tags: ['creative'] },
      summary: 'c1',
    },
  ],
  expected: [
    {
      candidateId: 'c1',
      expectedFinalScore: 85,
      expectedReasoning: 'good',
      shouldTriggerDealBreaker: false,
    },
  ],
};

describe('runStrategy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('happy path: valid JSON output → RunResult with populated metrics', async () => {
    vi.mocked(callOpenRouter).mockResolvedValue({
      content: JSON.stringify({
        matches: [
          {
            targetUserId: 'c1',
            unidirectionalScore: 85,
            reciprocityScore: 85,
            finalScore: 85,
            reason: 'good fit',
          },
        ],
      }),
      promptTokens: 1000,
      completionTokens: 200,
    });

    const result = await runStrategy(strategy, pair);

    expect(result.error).toBeUndefined();
    expect(result.output?.matches).toHaveLength(1);
    expect(result.metrics).not.toBeNull();
    expect(result.metrics!.scoreDeltaAvg).toBe(0);
    expect(result.metrics!.costUsd).not.toBeNull();
    expect(result.metrics!.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('malformed JSON → RunResult with error + rawOutput preserved', async () => {
    vi.mocked(callOpenRouter).mockResolvedValue({
      content: 'this is not JSON {oops',
      promptTokens: 500,
      completionTokens: 10,
    });

    const result = await runStrategy(strategy, pair);

    expect(result.error).toBeDefined();
    expect(result.error).toMatch(/parse|JSON/i);
    expect(result.rawOutput).toBe('this is not JSON {oops');
    expect(result.output).toBeNull();
    expect(result.metrics).toBeNull();
  });

  it('empty content → RunResult with empty-content error', async () => {
    vi.mocked(callOpenRouter).mockResolvedValue({
      content: '',
      promptTokens: 500,
      completionTokens: 0,
    });

    const result = await runStrategy(strategy, pair);

    expect(result.error).toMatch(/empty/i);
    expect(result.metrics).toBeNull();
  });

  it('LLM drops a candidate → RunResult with MetricsInvariantError message and missing IDs', async () => {
    const pairWithTwoCandidates: EvalPair = {
      ...pair,
      candidates: [
        ...pair.candidates,
        {
          id: 'c2',
          name: 'Riley',
          persona: { summary: 'Quiet.', tags: ['quiet'] },
          ideal_partner: { summary: 'Anyone.', tags: [] },
          summary: 'c2',
        },
      ],
      expected: [
        ...pair.expected,
        { candidateId: 'c2', expectedFinalScore: 40, expectedReasoning: 'meh' },
      ],
    };

    vi.mocked(callOpenRouter).mockResolvedValue({
      content: JSON.stringify({
        matches: [
          {
            targetUserId: 'c1',
            unidirectionalScore: 85,
            reciprocityScore: 85,
            finalScore: 85,
            reason: 'good',
          },
          // c2 missing!
        ],
      }),
      promptTokens: 1000,
      completionTokens: 200,
    });

    const result = await runStrategy(strategy, pairWithTwoCandidates);

    expect(result.error).toMatch(/c2/);
    expect(result.output).not.toBeNull(); // parsed OK, metrics failed
    expect(result.metrics).toBeNull();
  });

  it('OpenRouter throws → RunResult with error, no crash', async () => {
    vi.mocked(callOpenRouter).mockRejectedValue(new Error('OpenRouter 429: rate limited'));

    const result = await runStrategy(strategy, pair);

    expect(result.error).toMatch(/rate limited/);
    expect(result.output).toBeNull();
    expect(result.metrics).toBeNull();
  });

  it('cost calculation uses token counts and price table', async () => {
    vi.mocked(callOpenRouter).mockResolvedValue({
      content: JSON.stringify({
        matches: [
          {
            targetUserId: 'c1',
            unidirectionalScore: 85,
            reciprocityScore: 85,
            finalScore: 85,
            reason: 'ok',
          },
        ],
      }),
      promptTokens: 1_000_000, // 1M input tokens
      completionTokens: 1_000_000, // 1M output tokens
    });

    const result = await runStrategy(strategy, pair);
    // gemini-2.5-flash: 0.075 + 0.30 = 0.375 per 1M/1M split
    expect(result.metrics?.costUsd).toBeCloseTo(0.375, 4);
  });
});
