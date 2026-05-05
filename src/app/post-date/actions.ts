'use server';
/**
 * Post-date feedback server actions. All run as the calling user
 * (RLS-enforced) via createSupabaseServerClient. The cron route at
 * src/app/api/post-date-nudge/route.ts uses supabase-admin instead.
 */

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/supabase/server';
import { verifyAuth } from '@/lib/verify-auth';
import { postDateCheckIn } from '@/ai/flows/post-date-check-in';

const HARD_TURN_CAP = 12;

type ConvoTurn = { role: 'vera' | 'user'; text: string; ts: string };

const FORCED_CLOSER = "Thanks for sharing 💜 — this helps me get to know you.";

function veraTurn(text: string): ConvoTurn {
  return { role: 'vera', text, ts: new Date().toISOString() };
}

function userTurn(text: string): ConvoTurn {
  return { role: 'user', text, ts: new Date().toISOString() };
}

/**
 * Called when the user clicks the manual "I went on this date" button on
 * /requests. Creates (or returns the existing) date_feedback row for this
 * (chat_request, user) pair, seeds the opener if new, returns the row id.
 */
export async function startManualCheckIn(
  chatRequestId: string,
): Promise<{ feedbackId: string }> {
  const user = await verifyAuth();
  const supabase = await createSupabaseServerClient();

  const { data: cr, error: crErr } = await supabase
    .from('chat_requests')
    .select('id, sender_id, receiver_id, sender_name, receiver_name, suggested_date_time, suggested_location')
    .eq('id', chatRequestId)
    .single();
  if (crErr || !cr) throw new Error('Date not found');
  if (cr.sender_id !== user.id && cr.receiver_id !== user.id) {
    throw new Error('Not your date');
  }

  const { data: existing } = await supabase
    .from('date_feedback')
    .select('id, conversation, status')
    .eq('chat_request_id', chatRequestId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) {
    return { feedbackId: existing.id };
  }

  const opener = veraTurn('How did it go? Even just a word.');

  const { data: created, error: insErr } = await supabase
    .from('date_feedback')
    .insert({
      chat_request_id: chatRequestId,
      user_id: user.id,
      conversation: [opener],
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (insErr || !created) throw new Error(insErr?.message ?? 'Failed to start check-in');

  // Status is in the column-level revoke list — flip via admin client.
  const { supabaseAdmin } = await import('@/lib/supabase-admin');
  const { error: statusErr } = await supabaseAdmin
    .from('date_feedback')
    .update({ status: 'in_progress' })
    .eq('id', created.id);
  if (statusErr) throw new Error(statusErr.message);

  revalidatePath('/requests');
  return { feedbackId: created.id };
}

/**
 * Append the user's turn, call the AI flow, append Vera's turn, and update
 * status if Vera signalled isClosingTurn or we hit the hard turn cap.
 */
export async function submitCheckInTurn(
  feedbackId: string,
  userText: string,
  pillChoice?: 'positive' | 'neutral' | 'negative',
): Promise<{ veraResponse: string; isClosingTurn: boolean }> {
  const user = await verifyAuth();
  const supabase = await createSupabaseServerClient();

  const { data: row, error: readErr } = await supabase
    .from('date_feedback')
    .select(
      'id, chat_request_id, conversation, status, chat_requests(sender_id, receiver_id, sender_name, receiver_name, suggested_date_time, suggested_location)'
    )
    .eq('id', feedbackId)
    .eq('user_id', user.id)
    .single();
  if (readErr || !row) throw new Error('Feedback row not found');
  if (row.status === 'completed' || row.status === 'dismissed') {
    throw new Error('This check-in is closed.');
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cr = (row as any).chat_requests as {
    sender_id: string; receiver_id: string;
    sender_name: string | null; receiver_name: string | null;
    suggested_date_time: string | null; suggested_location: string | null;
  };
  const matchName = cr.sender_id === user.id ? (cr.receiver_name ?? 'them') : (cr.sender_name ?? 'them');

  const conversation: ConvoTurn[] = [
    ...(row.conversation as ConvoTurn[]),
    userTurn(userText),
  ];

  const turnsAfterUser = conversation.length;

  let veraResponse: string;
  let isClosingTurn: boolean;

  if (turnsAfterUser >= HARD_TURN_CAP) {
    veraResponse = FORCED_CLOSER;
    isClosingTurn = true;
  } else {
    const aiOut = await postDateCheckIn({
      pillChoice: pillChoice ?? null,
      conversation,
      match: { name: matchName },
      dateMeta: {
        suggestedDateTime: cr.suggested_date_time,
        suggestedLocation: cr.suggested_location,
      },
      preferredLanguage: 'English',
    });
    veraResponse = aiOut.response;
    isClosingTurn = aiOut.isClosingTurn;
  }

  conversation.push(veraTurn(veraResponse));

  const { supabaseAdmin } = await import('@/lib/supabase-admin');
  const update: Record<string, unknown> = {
    conversation,
    updated_at: new Date().toISOString(),
  };
  if (pillChoice && !row.conversation.some((t: ConvoTurn) => t.role === 'user')) {
    update.pill_choice = pillChoice;
  }
  if (isClosingTurn) {
    update.status = 'completed';
    update.completed_at = new Date().toISOString();
  }

  const { error: updErr } = await supabaseAdmin
    .from('date_feedback')
    .update(update)
    .eq('id', feedbackId);
  if (updErr) throw new Error(updErr.message);

  if (isClosingTurn) {
    await supabaseAdmin
      .from('chat_requests')
      .update({ date_status: 'completed' })
      .eq('id', row.chat_request_id);
  }

  revalidatePath('/bot');
  revalidatePath('/requests');
  return { veraResponse, isClosingTurn };
}

/**
 * "I'd rather not say" path. Marks the row dismissed and appends Vera's
 * boundary closer. Idempotent on already-dismissed rows.
 */
export async function dismissCheckIn(
  feedbackId: string,
): Promise<{ ok: true }> {
  const user = await verifyAuth();
  const supabase = await createSupabaseServerClient();

  const { data: row, error: readErr } = await supabase
    .from('date_feedback')
    .select('id, conversation, status')
    .eq('id', feedbackId)
    .eq('user_id', user.id)
    .single();
  if (readErr || !row) throw new Error('Feedback row not found');
  if (row.status === 'dismissed') return { ok: true };
  if (row.status === 'completed') {
    throw new Error('Already completed — cannot dismiss.');
  }

  const closer = veraTurn("Completely understood. I won't ask again about this one.");
  const conversation = [...(row.conversation as ConvoTurn[]), closer];

  const { supabaseAdmin } = await import('@/lib/supabase-admin');
  const { error: updErr } = await supabaseAdmin
    .from('date_feedback')
    .update({
      status: 'dismissed',
      pill_choice: 'dismissed',
      conversation,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', feedbackId);
  if (updErr) throw new Error(updErr.message);

  revalidatePath('/bot');
  revalidatePath('/requests');
  return { ok: true };
}
