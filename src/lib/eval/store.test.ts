import { describe, it, expect, beforeEach } from 'vitest';
import { LocalStorageEvalStore } from './store';
import type { EvalPair, Strategy, RunResult } from './types';

function samplePair(id: string): EvalPair {
  return {
    id,
    label: `pair ${id}`,
    currentUser: {
      id: 'u1',
      name: 'User 1',
      persona: { summary: 's', tags: ['a'] },
      ideal_partner: { summary: 's', tags: ['b'] },
      summary: 'u1',
    },
    candidates: [
      {
        id: 'c1',
        name: 'Candidate 1',
        persona: { summary: 's', tags: ['a'] },
        ideal_partner: { summary: 's', tags: ['b'] },
        summary: 'c1',
      },
    ],
    expected: [
      { candidateId: 'c1', expectedFinalScore: 70, expectedReasoning: 'ok' },
    ],
  };
}

function sampleStrategy(id: string): Strategy {
  return {
    id,
    name: id,
    model: 'google/gemini-2.5-flash',
    promptVariant: 'default',
    runCount: 1,
  };
}

function sampleResult(id: string, strategyId: string, pairId: string): RunResult {
  return {
    id,
    strategyId,
    pairId,
    timestamp: new Date().toISOString(),
    output: null,
    metrics: null,
    error: 'test',
  };
}

describe('LocalStorageEvalStore', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('round-trips a saved pair', async () => {
    const store = new LocalStorageEvalStore({ skipSeeding: true });
    await store.savePair(samplePair('p1'));
    const pairs = await store.getPairs();
    expect(pairs).toHaveLength(1);
    expect(pairs[0].id).toBe('p1');
  });

  it('deletes a pair by id', async () => {
    const store = new LocalStorageEvalStore({ skipSeeding: true });
    await store.savePair(samplePair('p1'));
    await store.savePair(samplePair('p2'));
    await store.deletePair('p1');
    const pairs = await store.getPairs();
    expect(pairs).toHaveLength(1);
    expect(pairs[0].id).toBe('p2');
  });

  it('seeds default pairs and strategies on first access when seeding is enabled', async () => {
    const store = new LocalStorageEvalStore();
    const pairs = await store.getPairs();
    const strategies = await store.getStrategies();
    expect(pairs.length).toBeGreaterThan(0);
    expect(strategies.length).toBeGreaterThan(0);
    expect(strategies.some(s => s.id === 'llama-3-8b-budget')).toBe(true);
  });

  it('does not re-seed if data already exists', async () => {
    const store1 = new LocalStorageEvalStore({ skipSeeding: true });
    await store1.savePair(samplePair('only-one'));

    const store2 = new LocalStorageEvalStore();
    const pairs = await store2.getPairs();
    expect(pairs).toHaveLength(1);
    expect(pairs[0].id).toBe('only-one');
  });

  it('round-trips and clears results', async () => {
    const store = new LocalStorageEvalStore({ skipSeeding: true });
    await store.saveResult(sampleResult('r1', 's1', 'p1'));
    await store.saveResult(sampleResult('r2', 's1', 'p1'));
    let results = await store.getResults();
    expect(results).toHaveLength(2);

    await store.clearResults();
    results = await store.getResults();
    expect(results).toHaveLength(0);
  });

  it('returns empty arrays under SSR (window undefined)', async () => {
    const originalWindow = globalThis.window;
    // @ts-expect-error simulate SSR
    delete globalThis.window;

    const store = new LocalStorageEvalStore({ skipSeeding: true });
    expect(await store.getPairs()).toEqual([]);
    expect(await store.getStrategies()).toEqual([]);
    expect(await store.getResults()).toEqual([]);

    globalThis.window = originalWindow;
  });
});
