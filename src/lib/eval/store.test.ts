import { describe, it, expect, beforeEach } from 'vitest';
import { LocalStorageEvalStore } from './store';
import type { EvalRow, Strategy, RunResult } from './types';

function sampleRow(id: string): EvalRow {
  return {
    id,
    label: `row ${id}`,
    profileA: 'A content',
    profileB: 'B content',
    expected: { score: 70, reasoning: 'test' },
    tags: ['test-tag'],
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

function sampleResult(id: string, strategyId: string, rowId: string): RunResult {
  return {
    id,
    strategyId,
    rowId,
    runIndex: 0,
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

  it('round-trips a saved row', async () => {
    const store = new LocalStorageEvalStore({ skipSeeding: true });
    await store.saveRow(sampleRow('r1'));
    const rows = await store.getRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe('r1');
  });

  it('deletes a row by id', async () => {
    const store = new LocalStorageEvalStore({ skipSeeding: true });
    await store.saveRow(sampleRow('r1'));
    await store.saveRow(sampleRow('r2'));
    await store.deleteRow('r1');
    const rows = await store.getRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe('r2');
  });

  it('seeds v2 defaults on first access when seeding is enabled', async () => {
    const store = new LocalStorageEvalStore();
    const rows = await store.getRows();
    const strategies = await store.getStrategies();
    expect(rows.length).toBeGreaterThan(0);
    expect(strategies.length).toBeGreaterThan(0);
    // Must include the Sonnet fix
    expect(strategies.some(s => s.id === 'claude-sonnet-4')).toBe(true);
    // Must NOT include the v1 broken ID
    expect(strategies.some(s => s.id === 'claude-sonnet-default')).toBe(false);
  });

  it('does not re-seed if data already exists', async () => {
    const store1 = new LocalStorageEvalStore({ skipSeeding: true });
    await store1.saveRow(sampleRow('only-one'));

    const store2 = new LocalStorageEvalStore();
    const rows = await store2.getRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe('only-one');
  });

  it('cascade deletes results when a row is deleted', async () => {
    const store = new LocalStorageEvalStore({ skipSeeding: true });
    await store.saveRow(sampleRow('r1'));
    await store.saveRow(sampleRow('r2'));
    await store.saveResult(sampleResult('res1', 's1', 'r1'));
    await store.saveResult(sampleResult('res2', 's1', 'r2'));
    await store.saveResult(sampleResult('res3', 's2', 'r1'));

    await store.deleteResultsForRow('r1');
    const results = await store.getResults();
    expect(results).toHaveLength(1);
    expect(results[0].rowId).toBe('r2');
  });

  it('cascade deletes results when a strategy is deleted', async () => {
    const store = new LocalStorageEvalStore({ skipSeeding: true });
    await store.saveResult(sampleResult('res1', 's1', 'r1'));
    await store.saveResult(sampleResult('res2', 's2', 'r1'));
    await store.saveResult(sampleResult('res3', 's1', 'r2'));

    await store.deleteResultsForStrategy('s1');
    const results = await store.getResults();
    expect(results).toHaveLength(1);
    expect(results[0].strategyId).toBe('s2');
  });

  it('clears all results', async () => {
    const store = new LocalStorageEvalStore({ skipSeeding: true });
    await store.saveResult(sampleResult('res1', 's1', 'r1'));
    await store.saveResult(sampleResult('res2', 's1', 'r2'));
    await store.clearResults();
    const results = await store.getResults();
    expect(results).toHaveLength(0);
  });

  it('detects v1 localStorage and wipes + re-seeds', async () => {
    // Simulate v1 data: eval.pairs key with objects containing v1-specific fields.
    localStorage.setItem(
      'eval.pairs',
      JSON.stringify([{ id: 'p1', candidates: [{ id: 'c1' }], expected: [{ candidateId: 'c1', expectedFinalScore: 80 }] }]),
    );
    localStorage.setItem(
      'eval.strategies',
      JSON.stringify([{ id: 'old-strategy', model: 'anthropic/claude-3.5-sonnet' }]),
    );

    const store = new LocalStorageEvalStore();
    const rows = await store.getRows();

    // v1 wiped + v2 seeded. New data is present, old key is gone.
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]).toHaveProperty('profileA');
    expect(rows[0]).not.toHaveProperty('candidates');
    expect(localStorage.getItem('eval.pairs')).toBeNull();

    // Wipe flag is set so subsequent getV1WipeNotice returns true once.
    expect(store.consumeV1WipeNotice()).toBe(true);
    expect(store.consumeV1WipeNotice()).toBe(false); // only fires once
  });

  it('returns empty arrays under SSR (window undefined)', async () => {
    const originalWindow = globalThis.window;
    // @ts-expect-error simulate SSR
    delete globalThis.window;

    try {
      const store = new LocalStorageEvalStore({ skipSeeding: true });
      expect(await store.getRows()).toEqual([]);
      expect(await store.getStrategies()).toEqual([]);
      expect(await store.getResults()).toEqual([]);
    } finally {
      globalThis.window = originalWindow;
    }
  });
});
