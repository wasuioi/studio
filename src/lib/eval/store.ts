import {
  EvalStorageFullError,
  type EvalPair,
  type Strategy,
  type RunResult,
} from './types';
import { seedPairs, seedStrategies } from './seed-data';

export interface EvalStore {
  getPairs(): Promise<EvalPair[]>;
  savePair(pair: EvalPair): Promise<void>;
  deletePair(id: string): Promise<void>;

  getStrategies(): Promise<Strategy[]>;
  saveStrategy(s: Strategy): Promise<void>;
  deleteStrategy(id: string): Promise<void>;

  getResults(): Promise<RunResult[]>;
  saveResult(r: RunResult): Promise<void>;
  clearResults(): Promise<void>;
}

const KEYS = {
  pairs: 'eval.pairs',
  strategies: 'eval.strategies',
  results: 'eval.results',
} as const;

interface StoreOptions {
  skipSeeding?: boolean;
}

export class LocalStorageEvalStore implements EvalStore {
  private seeded = false;
  constructor(private readonly options: StoreOptions = {}) {}

  async getPairs(): Promise<EvalPair[]> {
    if (!this.isBrowser()) return [];
    this.seedIfNeeded();
    return this.read<EvalPair[]>(KEYS.pairs, []);
  }

  async savePair(pair: EvalPair): Promise<void> {
    if (!this.isBrowser()) return;
    this.seedIfNeeded();
    const pairs = this.read<EvalPair[]>(KEYS.pairs, []);
    const idx = pairs.findIndex(p => p.id === pair.id);
    if (idx >= 0) pairs[idx] = pair;
    else pairs.push(pair);
    this.write(KEYS.pairs, pairs);
  }

  async deletePair(id: string): Promise<void> {
    if (!this.isBrowser()) return;
    const pairs = this.read<EvalPair[]>(KEYS.pairs, []);
    this.write(KEYS.pairs, pairs.filter(p => p.id !== id));
  }

  async getStrategies(): Promise<Strategy[]> {
    if (!this.isBrowser()) return [];
    this.seedIfNeeded();
    return this.read<Strategy[]>(KEYS.strategies, []);
  }

  async saveStrategy(s: Strategy): Promise<void> {
    if (!this.isBrowser()) return;
    this.seedIfNeeded();
    const strategies = this.read<Strategy[]>(KEYS.strategies, []);
    const idx = strategies.findIndex(x => x.id === s.id);
    if (idx >= 0) strategies[idx] = s;
    else strategies.push(s);
    this.write(KEYS.strategies, strategies);
  }

  async deleteStrategy(id: string): Promise<void> {
    if (!this.isBrowser()) return;
    const strategies = this.read<Strategy[]>(KEYS.strategies, []);
    this.write(KEYS.strategies, strategies.filter(x => x.id !== id));
  }

  async getResults(): Promise<RunResult[]> {
    if (!this.isBrowser()) return [];
    return this.read<RunResult[]>(KEYS.results, []);
  }

  async saveResult(r: RunResult): Promise<void> {
    if (!this.isBrowser()) return;
    const results = this.read<RunResult[]>(KEYS.results, []);
    results.push(r);
    try {
      this.write(KEYS.results, results);
    } catch (err) {
      if (err instanceof Error && err.name === 'QuotaExceededError') {
        throw new EvalStorageFullError(
          'Browser storage is full. Clear old eval results from the Results tab.',
        );
      }
      throw err;
    }
  }

  async clearResults(): Promise<void> {
    if (!this.isBrowser()) return;
    this.write(KEYS.results, []);
  }

  private isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  }

  private read<T>(key: string, fallback: T): T {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      console.error(`[LocalStorageEvalStore] corrupt entry for ${key}, resetting`);
      return fallback;
    }
  }

  private write<T>(key: string, value: T): void {
    window.localStorage.setItem(key, JSON.stringify(value));
  }

  private seedIfNeeded(): void {
    if (this.seeded || this.options.skipSeeding) return;
    this.seeded = true;

    if (!window.localStorage.getItem(KEYS.pairs)) {
      this.write(KEYS.pairs, seedPairs);
    }
    if (!window.localStorage.getItem(KEYS.strategies)) {
      this.write(KEYS.strategies, seedStrategies);
    }
  }
}
