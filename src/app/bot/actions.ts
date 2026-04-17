// src/app/bot/actions.ts
'use server';

import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyAuth } from '@/lib/verify-auth';
import { TESTER_PROFILE } from '@/lib/dev-tools/fixtures/tester-profile';
import { TESTER_PERSONALITY } from '@/lib/dev-tools/fixtures/tester-personality';
import { TESTER_BIO } from '@/lib/dev-tools/fixtures/tester-bio';
import { TESTER_CONVERSATION } from '@/lib/dev-tools/fixtures/tester-conversation';
import { FAKE_MATCHES } from '@/lib/dev-tools/fixtures/fake-matches';

/**
 * Advance the current user's stage. Rejects attempts to move backwards.
 * Writes via supabaseAdmin because migration 008 revokes UPDATE(stage) from
 * the authenticated role.
 */
export async function updateUserStage(newStage: number): Promise<{ success: boolean }> {
  const user = await verifyAuth();
  const userId = user.id;

  if (!Number.isInteger(newStage) || newStage < 1 || newStage > 3) {
    throw new Error(`Invalid stage: ${newStage}`);
  }

  const { data: existing, error: readErr } = await supabaseAdmin
    .from('profiles')
    .select('stage')
    .eq('id', userId)
    .single();

  if (readErr) throw readErr;

  const currentStage = existing?.stage ?? 0;
  if (newStage <= currentStage) {
    // Already at or past this stage — no-op, not an error.
    return { success: true };
  }

  const { error: updateErr } = await supabaseAdmin
    .from('profiles')
    .update({ stage: newStage, updated_at: new Date().toISOString() })
    .eq('id', userId);

  if (updateErr) throw updateErr;

  return { success: true };
}

/**
 * DEV-ONLY. Double-gated by ENABLE_DEV_TOOLS env var. Seeds the current user
 * with fixture data and sets their stage (or resets to 0). Delete this export
 * before production rollout — see src/lib/dev-tools/README.md.
 */
export async function devForceStage(
  targetStage: 0 | 1 | 2 | 3
): Promise<{ success: boolean }> {
  if (process.env.ENABLE_DEV_TOOLS !== 'true') {
    throw new Error('Dev tools are disabled (ENABLE_DEV_TOOLS is not "true")');
  }

  const user = await verifyAuth();
  const userId = user.id;

  // Dev shortcut: mark email as confirmed so posts RLS (is_email_verified)
  // passes without needing the real email flow. No-op if already confirmed.
  const confirmErr = await supabaseAdmin.auth.admin.updateUserById(userId, {
    email_confirm: true,
  });
  if (confirmErr.error) {
    throw new Error(`email_confirm: ${confirmErr.error.message}`);
  }

  if (targetStage === 0) {
    // Reset: clear personality_profile + bot_chats + photo_url so the
    // photo-upload flow can be tested from a genuinely empty state.
    const d1 = await supabaseAdmin.from('bot_chats').delete().eq('user_id', userId);
    if (d1.error) throw new Error(`bot_chats delete: ${d1.error.message}`);
    const d2 = await supabaseAdmin.from('personality_profiles').delete().eq('user_id', userId);
    if (d2.error) throw new Error(`personality_profiles delete: ${d2.error.message}`);
    // Upsert so accounts that pre-date the handle_new_user trigger still get
    // a profiles row instead of silently doing nothing.
    const u1 = await supabaseAdmin
      .from('profiles')
      .upsert(
        {
          id: userId,
          email: user.email ?? '',
          stage: 0,
          bio: null,
          photo_url: null,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          personality_profile: null as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          top_matches: null as any,
          profile_completed: false,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );
    if (u1.error) throw new Error(`profiles upsert (reset): ${u1.error.message}`);
    return { success: true };
  }

  // Stage 1+ — seed fixtures. photo_url is intentionally cleared so the
  // developer can upload their own photo via the in-chat 📎 button. The
  // bot page shows that button whenever stage >= 1 && !photo_url.
  // top_matches is seeded at stage >= 2 so the /matches page has visible
  // cards without needing real users in the DB.
  const topMatches = targetStage >= 2 ? FAKE_MATCHES : null;

  // Upsert so accounts that pre-date the handle_new_user trigger still get
  // a profiles row created (instead of the update matching 0 rows silently,
  // which then breaks the personality_profiles FK on the next step).
  const u2 = await supabaseAdmin
    .from('profiles')
    .upsert(
      {
        id: userId,
        email: user.email ?? '',
        display_name: TESTER_PROFILE.display_name,
        location: TESTER_PROFILE.location,
        photo_url: null,
        bio: TESTER_BIO,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        personality_profile: TESTER_PERSONALITY as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        top_matches: topMatches as any,
        profile_completed: true,
        stage: targetStage,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );
  if (u2.error) throw new Error(`profiles upsert (stage ${targetStage}): ${u2.error.message}`);

  // Upsert the personality_profiles row.
  const up = await supabaseAdmin.from('personality_profiles').upsert({
    user_id: userId,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    traits: TESTER_PERSONALITY as any,
    partner_vision: TESTER_PERSONALITY.ideal_partner.summary,
    summary: TESTER_PERSONALITY.user_persona.summary,
    completed_at: new Date().toISOString(),
  });
  if (up.error) throw new Error(`personality_profiles upsert: ${up.error.message}`);

  // Seed a bot_chats row only if none exists yet.
  const { data: existingChat, error: readChatErr } = await supabaseAdmin
    .from('bot_chats')
    .select('id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();
  if (readChatErr) throw new Error(`bot_chats read: ${readChatErr.message}`);

  if (!existingChat) {
    const ins = await supabaseAdmin.from('bot_chats').insert({
      user_id: userId,
      phase: 3,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      messages: TESTER_CONVERSATION as any,
      completed: true,
    });
    if (ins.error) throw new Error(`bot_chats insert: ${ins.error.message}`);
  }

  return { success: true };
}
