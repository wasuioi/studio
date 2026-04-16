import {
  EvalStorageFullError,
  type EvalRow,
  type Strategy,
  type RunResult,
} from './types';
import { seedRows, seedStrategies } from './seed-data';

export interface EvalStore {
  getRows(): Promise<EvalRow[]>;
  saveRow(row: EvalRow): Promise<void>;
  deleteRow(id: string): Promise<void>;

  getStrategies(): Promise<Strategy[]>;
  saveStrategy(s: Strategy): Promise<void>;
  deleteStrategy(id: string): Promise<void>;

  getResults(): Promise<RunResult[]>;
  saveResult(r: RunResult): Promise<void>;
  deleteResultsForRow(rowId: string): Promise<void>;
  deleteResultsForStrategy(strategyId: string): Promise<void>;
  clearResults(): Promise<void>;
}

const KEYS = {
  rows: 'eval.rows',
  strategies: 'eval.strategies',
  results: 'eval.results',
  // v1 legacy key — checked at startup for migration detection
  v1Pairs: 'eval.pairs',
} as const;

interface StoreOptions {
  skipSeeding?: boolean;
}

export class LocalStorageEvalStore implements EvalStore {
  private seeded = false;
  private v1WipeOccurred = false;
  constructor(private readonly options: StoreOptions = {}) {}

  // --- Rows ---

  async getRows(): Promise<EvalRow[]> {
    if (!this.isBrowser()) return [];
    this.seedIfNeeded();
    return this.read<EvalRow[]>(KEYS.rows, []);
  }

  async saveRow(row: EvalRow): Promise<void> {
    if (!this.isBrowser()) return;
    this.seedIfNeeded();
    const rows = this.read<EvalRow[]>(KEYS.rows, []);
    const idx = rows.findIndex(r => r.id === row.id);
    if (idx >= 0) rows[idx] = row;
    else rows.push(row);
    this.write(KEYS.rows, rows);
  }

  async deleteRow(id: string): Promise<void> {
    if (!this.isBrowser()) return;
    const rows = this.read<EvalRow[]>(KEYS.rows, []);
    this.write(KEYS.rows, rows.filter(r => r.id !== id));
  }

  // --- Strategies ---

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

  // --- Results ---

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

  async deleteResultsForRow(rowId: string): Promise<void> {
    if (!this.isBrowser()) return;
    const results = this.read<RunResult[]>(KEYS.results, []);
    this.write(KEYS.results, results.filter(r => r.rowId !== rowId));
  }

  async deleteResultsForStrategy(strategyId: string): Promise<void> {
    if (!this.isBrowser()) return;
    const results = this.read<RunResult[]>(KEYS.results, []);
    this.write(KEYS.results, results.filter(r => r.strategyId !== strategyId));
  }

  async clearResults(): Promise<void> {
    if (!this.isBrowser()) return;
    this.write(KEYS.results, []);
  }

  // --- v1 migration notice (read-once flag consumed by the UI) ---

  consumeV1WipeNotice(): boolean {
    const val = this.v1WipeOccurred;
    this.v1WipeOccurred = false;
    return val;
  }

  // --- helpers ---

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

    // 1. Detect v1 data (by presence of the old eval.pairs key OR by v1-shaped strategies).
    const v1Detected = this.detectV1Data();
    if (v1Detected) {
      // Wipe all eval.* keys — a clean slate for v2.
      window.localStorage.removeItem(KEYS.v1Pairs);
      window.localStorage.removeItem(KEYS.rows);
      window.localStorage.removeItem(KEYS.strategies);
      window.localStorage.removeItem(KEYS.results);
      this.v1WipeOccurred = true;
    }

    // 2. Seed defaults if the v2 keys are missing.
    if (!window.localStorage.getItem(KEYS.rows)) {
      this.write(KEYS.rows, seedRows);
    }
    if (!window.localStorage.getItem(KEYS.strategies)) {
      this.write(KEYS.strategies, seedStrategies);
    }
  }

  private detectV1Data(): boolean {
    // v1 stored rows under eval.pairs — its mere presence is a strong signal.
    if (window.localStorage.getItem(KEYS.v1Pairs) != null) return true;

    // Also check stored strategies for v1-shaped entries (e.g. claude-3.5-sonnet).
    try {
      const rawStrategies = window.localStorage.getItem(KEYS.strategies);
      if (rawStrategies) {
        const parsed = JSON.parse(rawStrategies) as unknown;
        if (Array.isArray(parsed)) {
          for (const s of parsed as Array<Record<string, unknown>>) {
            if (s?.model === 'anthropic/claude-3.5-sonnet') return true;
          }
        }
      }
    } catch {
      // corrupt or missing; fall through
    }

    return false;
  }
}
