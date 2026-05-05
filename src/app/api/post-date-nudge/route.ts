// src/app/api/post-date-nudge/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import {
  type ConvoTurn,
  veraTurn,
  VERA_OPENER,
  VERA_SECOND_NUDGE,
} from '@/lib/post-date';

const FIRST_NUDGE_DELAY_HOURS = 24;
const SECOND_NUDGE_DELAY_HOURS = 48;

export async function GET(request: NextRequest) {
  // Vercel Cron sends Authorization: Bearer <CRON_SECRET>.
  const auth = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  return NextResponse.json(await runNudgeSweep());
}

/**
 * Exposed so the dev tool (devFirePostDateNudgesNow) can call the same
 * logic against the current user's rows without going through cron auth.
 */
export async function runNudgeSweep(scopeUserId?: string): Promise<{
  processed: number;
  sentFirst: number;
  sentSecond: number;
}> {
  const now = new Date();
  const firstCutoff = new Date(now.getTime() - FIRST_NUDGE_DELAY_HOURS * 3600_000);
  const secondCutoff = new Date(now.getTime() - SECOND_NUDGE_DELAY_HOURS * 3600_000);

  let crQuery = supabaseAdmin
    .from('chat_requests')
    .select('id, sender_id, receiver_id, scheduled_at, date_status')
    .eq('date_status', 'planned')
    .not('scheduled_at', 'is', null)
    .lte('scheduled_at', firstCutoff.toISOString());
  if (scopeUserId) {
    crQuery = crQuery.or(`sender_id.eq.${scopeUserId},receiver_id.eq.${scopeUserId}`);
  }

  const { data: candidates, error: crErr } = await crQuery;
  if (crErr) throw new Error(`chat_requests scan: ${crErr.message}`);
  if (!candidates) return { processed: 0, sentFirst: 0, sentSecond: 0 };

  let sentFirst = 0;
  let sentSecond = 0;

  for (const cr of candidates) {
    const userIds = scopeUserId ? [scopeUserId] : [cr.sender_id, cr.receiver_id];

    for (const userId of userIds) {
      const { data: existing } = await supabaseAdmin
        .from('date_feedback')
        .select('id, status, nudge_count, conversation, first_nudged_at')
        .eq('chat_request_id', cr.id)
        .eq('user_id', userId)
        .maybeSingle();

      // Case A — no row yet → send first nudge.
      if (!existing) {
        const ins = await supabaseAdmin.from('date_feedback').insert({
          chat_request_id: cr.id,
          user_id: userId,
          conversation: [veraTurn(VERA_OPENER)],
          status: 'nudged',
          nudge_count: 1,
          first_nudged_at: now.toISOString(),
        });
        if (!ins.error) sentFirst++;
        continue;
      }

      // Case B — first nudge sent, no response, second nudge due.
      if (
        existing.status === 'nudged' &&
        existing.nudge_count === 1 &&
        cr.scheduled_at &&
        new Date(cr.scheduled_at) <= secondCutoff
      ) {
        const newConvo: ConvoTurn[] = [
          ...(existing.conversation as ConvoTurn[]),
          veraTurn(VERA_SECOND_NUDGE),
        ];
        const upd = await supabaseAdmin
          .from('date_feedback')
          .update({
            conversation: newConvo,
            nudge_count: 2,
            second_nudged_at: now.toISOString(),
            updated_at: now.toISOString(),
          })
          .eq('id', existing.id);
        if (!upd.error) sentSecond++;
        continue;
      }

      // Case C — anything else (in_progress, completed, dismissed, or
      // already nudged twice) → skip.
    }
  }

  return {
    processed: candidates.length,
    sentFirst,
    sentSecond,
  };
}
