// src/lib/post-date.ts
/**
 * Shared types and helpers for the post-date feedback feature.
 * Used by both the user-facing server actions (src/app/post-date/actions.ts)
 * and the cron handler (src/app/api/post-date-nudge/route.ts).
 *
 * Vera's literal copy + AI prompt template live in
 * `src/ai/prompts/post-date-check-in-prompt.ts` and are re-exported here
 * so existing call sites keep working.
 */

export {
  VERA_OPENER,
  VERA_SECOND_NUDGE,
  VERA_DISMISS_CLOSER,
  FORCED_CLOSER,
} from '@/ai/prompts/post-date-check-in-prompt';

export type FeedbackStatus = 'nudged' | 'in_progress' | 'completed' | 'dismissed';
export type PillChoice = 'positive' | 'neutral' | 'negative' | 'dismissed';

export type ConvoTurn = {
  role: 'vera' | 'user';
  text: string;
  ts: string;
};

export const HARD_TURN_CAP = 12;

export function veraTurn(text: string): ConvoTurn {
  return { role: 'vera', text, ts: new Date().toISOString() };
}

export function userTurn(text: string): ConvoTurn {
  return { role: 'user', text, ts: new Date().toISOString() };
}
