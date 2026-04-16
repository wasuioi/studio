// src/lib/dev-tools/response-cache.ts
//
// DEV-ONLY. localStorage wrapper with a fixed key prefix so we can clear all
// cached AI outputs at once from the dev panel.
//
// Keys used by the app (one place — don't scatter string literals):
//   dev-cached-bio
//   dev-cached-personality
//   dev-cached-matches

const PREFIX = 'dev-cached-';

export type CacheKey = 'bio' | 'personality' | 'matches';

function fullKey(key: CacheKey): string {
  return `${PREFIX}${key}`;
}

export function getCached<T>(key: CacheKey): T | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(fullKey(key));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function setCached<T>(key: CacheKey, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(fullKey(key), JSON.stringify(value));
  } catch {
    // quota exceeded or private mode — silent fail is fine in dev
  }
}

export function clearAllCached(): void {
  if (typeof window === 'undefined') return;
  const keys: CacheKey[] = ['bio', 'personality', 'matches'];
  for (const k of keys) {
    window.localStorage.removeItem(fullKey(k));
  }
}

export function listCached(): Record<CacheKey, boolean> {
  if (typeof window === 'undefined') {
    return { bio: false, personality: false, matches: false };
  }
  return {
    bio: window.localStorage.getItem(fullKey('bio')) !== null,
    personality: window.localStorage.getItem(fullKey('personality')) !== null,
    matches: window.localStorage.getItem(fullKey('matches')) !== null,
  };
}
