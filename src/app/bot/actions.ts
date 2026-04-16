// src/app/bot/actions.ts
'use server';

import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyAuth } from '@/lib/verify-auth';
import { TESTER_PROFILE } from '@/lib/dev-tools/fixtures/tester-profile';
import { TESTER_PERSONALITY } from '@/lib/dev-tools/fixtures/tester-personality';
import { TESTER_BIO } from '@/lib/dev-tools/fixtures/tester-bio';
import { TESTER_CONVERSATION } from '@/lib/dev-tools/fixtures/tester-conversation';

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

  if (targetStage === 0) {
    // Reset: clear personality_profile + bot_chats + photo_url so the
    // photo-upload flow can be tested from a genuinely empty state.
    await supabaseAdmin.from('bot_chats').delete().eq('user_id', userId);
    await supabaseAdmin.from('personality_profiles').delete().eq('user_id', userId);
    await supabaseAdmin
      .from('profiles')
      .update({
        stage: 0,
        bio: null,
        photo_url: null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        personality_profile: null as any,
        profile_completed: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);
    return { success: true };
  }

  // Stage 1+ — seed fixtures. photo_url is intentionally cleared so the
  // developer can upload their own photo via the in-chat 📎 button. The
  // bot page shows that button whenever stage >= 1 && !photo_url.
  await supabaseAdmin
    .from('profiles')
    .update({
      display_name: TESTER_PROFILE.display_name,
      location: TESTER_PROFILE.location,
      photo_url: null,
      bio: TESTER_BIO,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      personality_profile: TESTER_PERSONALITY as any,
      profile_completed: true,
      stage: targetStage,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  // Upsert the personality_profiles row.
  await supabaseAdmin.from('personality_profiles').upsert({
    user_id: userId,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    traits: TESTER_PERSONALITY as any,
    partner_vision: TESTER_PERSONALITY.ideal_partner.summary,
    summary: TESTER_PERSONALITY.user_persona.summary,
    completed_at: new Date().toISOString(),
  });

  // Seed a bot_chats row only if none exists yet.
  const { data: existingChat } = await supabaseAdmin
    .from('bot_chats')
    .select('id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();

  if (!existingChat) {
    await supabaseAdmin.from('bot_chats').insert({
      user_id: userId,
      phase: 3,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      messages: TESTER_CONVERSATION as any,
      completed: true,
    });
  }

  return { success: true };
}
