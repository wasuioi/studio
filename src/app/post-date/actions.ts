// src/app/post-date/actions.ts
'use server';
/**
 * Post-date feedback server actions. All run as the calling user
 * (RLS-enforced) via createSupabaseServerClient. The cron route at
 * src/app/api/post-date-nudge/route.ts uses supabase-admin instead.
 */

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/supabase/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyAuth } from '@/lib/verify-auth';
import { postDateCheckIn } from '@/ai/flows/post-date-check-in';
import {
  type ConvoTurn,
  HARD_TURN_CAP,
  FORCED_CLOSER,
  VERA_OPENER,
  VERA_DISMISS_CLOSER,
  veraTurn,
  userTurn,
} from '@/lib/post-date';

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
    .select('id, sender_id, receiver_id')
    .eq('id', chatRequestId)
    .single();
  if (crErr || !cr) throw new Error('Date not found');
  if (cr.sender_id !== user.id && cr.receiver_id !== user.id) {
    throw new Error('Not your date');
  }

  // Reuse an existing row if one was already created (manual or by cron).
  const { data: existing } = await supabase
    .from('date_feedback')
    .select('id')
    .eq('chat_request_id', chatRequestId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) {
    return { feedbackId: existing.id };
  }

  // Insert atomically as the admin client so the privilege-locked
  // status='in_progress' lands in the same statement. Auth + ownership
  // are already verified above.
  const opener = veraTurn(VERA_OPENER);
  const { data: created, error: insErr } = await supabaseAdmin
    .from('date_feedback')
    .insert({
      chat_request_id: chatRequestId,
      user_id: user.id,
      conversation: [opener],
      status: 'in_progress',
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (insErr || !created) {
    throw new Error(insErr?.message ?? 'Failed to start check-in');
  }

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
      'id, chat_request_id, conversation, status, updated_at, chat_requests(sender_id, receiver_id, sender_name, receiver_name, suggested_date_time, suggested_location)',
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
    sender_id: string;
    receiver_id: string;
    sender_name: string | null;
    receiver_name: string | null;
    suggested_date_time: string | null;
    suggested_location: string | null;
  };
  const matchName =
    cr.sender_id === user.id ? cr.receiver_name ?? 'them' : cr.sender_name ?? 'them';

  const priorConversation = row.conversation as ConvoTurn[];
  const conversation: ConvoTurn[] = [...priorConversation, userTurn(userText)];

  let veraResponse: string;
  let isClosingTurn: boolean;

  if (conversation.length >= HARD_TURN_CAP) {
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

  const update: Record<string, unknown> = {
    conversation,
    updated_at: new Date().toISOString(),
  };
  // pill_choice is set only on the user's first turn.
  if (pillChoice && !priorConversation.some((t) => t.role === 'user')) {
    update.pill_choice = pillChoice;
  }
  if (isClosingTurn) {
    update.status = 'completed';
    update.completed_at = new Date().toISOString();
  }

  // Optimistic lock: only succeed if updated_at hasn't moved since we read.
  // Prevents lost-turn races between concurrent submissions.
  const { data: updated, error: updErr } = await supabaseAdmin
    .from('date_feedback')
    .update(update)
    .eq('id', feedbackId)
    .eq('updated_at', row.updated_at)
    .select('id');
  if (updErr) throw new Error(updErr.message);
  if (!updated || updated.length === 0) {
    throw new Error('This check-in was updated in another tab. Please reload.');
  }

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

  const closer = veraTurn(VERA_DISMISS_CLOSER);
  const conversation = [...(row.conversation as ConvoTurn[]), closer];

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
