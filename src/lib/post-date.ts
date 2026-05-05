// src/lib/post-date.ts
/**
 * Shared types and helpers for the post-date feedback feature.
 * Used by both the user-facing server actions (src/app/post-date/actions.ts)
 * and the cron handler (src/app/api/post-date-nudge/route.ts).
 */

export type FeedbackStatus = 'nudged' | 'in_progress' | 'completed' | 'dismissed';
export type PillChoice = 'positive' | 'neutral' | 'negative' | 'dismissed';

export type ConvoTurn = {
  role: 'vera' | 'user';
  text: string;
  ts: string;
};

export const HARD_TURN_CAP = 12;

export const FORCED_CLOSER =
  "Thanks for sharing 💜 — this helps me get to know you.";

export const VERA_OPENER = 'How did it go? Even just a word.';

export const VERA_SECOND_NUDGE =
  'Still thinking about your date — no pressure, just here if you want to share.';

export const VERA_DISMISS_CLOSER =
  "Completely understood. I won't ask again about this one.";

export function veraTurn(text: string): ConvoTurn {
  return { role: 'vera', text, ts: new Date().toISOString() };
}

export function userTurn(text: string): ConvoTurn {
  return { role: 'user', text, ts: new Date().toISOString() };
}
