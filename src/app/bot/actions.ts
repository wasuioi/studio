// src/app/bot/actions.ts
'use server';

import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyAuth } from '@/lib/verify-auth';
import { TESTER_PROFILE } from '@/lib/dev-tools/fixtures/tester-profile';
import { TESTER_PERSONALITY } from '@/lib/dev-tools/fixtures/tester-personality';
import { TESTER_BIO } from '@/lib/dev-tools/fixtures/tester-bio';
import { TESTER_CONVERSATION } from '@/lib/dev-tools/fixtures/tester-conversation';
import { FAKE_MATCHES } from '@/lib/dev-tools/fixtures/fake-matches';

function ensureDevToolsEnabled() {
  if (process.env.ENABLE_DEV_TOOLS !== 'true') {
    throw new Error('Dev tools are disabled (ENABLE_DEV_TOOLS is not "true")');
  }
}

/**
 * DEV-ONLY. Flip the current user's identity verification on/off. Used to
 * bypass the real /api/verify-identity flow while testing the date-invite
 * path. Delete this export before production rollout — see
 * src/lib/dev-tools/README.md.
 */
export async function devSetVerified(verified: boolean): Promise<{ success: boolean }> {
  ensureDevToolsEnabled();

  const user = await verifyAuth();

  // Dev shortcut: mark email as confirmed so is_email_verified() passes.
  const confirmErr = await supabaseAdmin.auth.admin.updateUserById(user.id, {
    email_confirm: true,
  });
  if (confirmErr.error) {
    throw new Error(`email_confirm: ${confirmErr.error.message}`);
  }

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({
      identity_verified: verified,
      verification_status: verified ? 'verified' : 'not_verified',
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id);

  if (error) throw new Error(`profiles update: ${error.message}`);

  return { success: true };
}

/**
 * DEV-ONLY. Seed the current user's profile with the tester fixtures so the
 * downstream flows (matches, profile page, etc.) have something to show
 * without chatting through Vera. photo_url is left empty on purpose so the
 * developer can exercise the upload path themselves.
 */
export async function devSeedDemoProfile(): Promise<{ success: boolean }> {
  ensureDevToolsEnabled();

  const user = await verifyAuth();
  const userId = user.id;

  const confirmErr = await supabaseAdmin.auth.admin.updateUserById(userId, {
    email_confirm: true,
  });
  if (confirmErr.error) {
    throw new Error(`email_confirm: ${confirmErr.error.message}`);
  }

  const u = await supabaseAdmin
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
        top_matches: FAKE_MATCHES as any,
        profile_completed: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );
  if (u.error) throw new Error(`profiles upsert: ${u.error.message}`);

  const up = await supabaseAdmin.from('personality_profiles').upsert({
    user_id: userId,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    traits: TESTER_PERSONALITY as any,
    partner_vision: TESTER_PERSONALITY.ideal_partner.summary,
    summary: TESTER_PERSONALITY.user_persona.summary,
    completed_at: new Date().toISOString(),
  });
  if (up.error) throw new Error(`personality_profiles upsert: ${up.error.message}`);

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

/**
 * DEV-ONLY. Seed a pending date invite from a stable "demo sender" account to
 * the current user so the /requests page has something to accept/decline
 * without needing a second real user. Upserts the demo sender's auth user +
 * profile on first call; reuses them on subsequent calls.
 */
export async function devSeedFakeInvite(): Promise<{ success: boolean; senderId: string }> {
  ensureDevToolsEnabled();

  const user = await verifyAuth();
  const DEMO_EMAIL = 'demo-sender@truevibe.dev';

  // Find the demo sender by email, create it if missing. listUsers paginates
  // (default 50/page) — fine for dev environments where user count is tiny.
  const list = await supabaseAdmin.auth.admin.listUsers();
  if (list.error) throw new Error(`listUsers: ${list.error.message}`);
  let demoId = list.data.users.find((u) => u.email === DEMO_EMAIL)?.id;

  if (!demoId) {
    const created = await supabaseAdmin.auth.admin.createUser({
      email: DEMO_EMAIL,
      email_confirm: true,
      password: crypto.randomUUID(),
    });
    if (created.error) throw new Error(`create demo sender: ${created.error.message}`);
    demoId = created.data.user?.id;
    if (!demoId) throw new Error('demo sender id missing');
  }

  if (demoId === user.id) {
    // The chat_requests CHECK (sender_id <> receiver_id) would reject this.
    // Only happens if a developer logs in as demo-sender@truevibe.dev directly.
    throw new Error('Cannot seed an invite to yourself (logged in as the demo sender).');
  }

  const demoSender = FAKE_MATCHES[0];

  // Upsert demo sender profile so the FK + denormalized sender fields agree.
  const p = await supabaseAdmin.from('profiles').upsert(
    {
      id: demoId,
      email: DEMO_EMAIL,
      display_name: demoSender.name,
      photo_url: demoSender.photoURL,
      profile_completed: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );
  if (p.error) throw new Error(`demo profile upsert: ${p.error.message}`);

  // UNIQUE (sender_id, receiver_id) on chat_requests blocks re-seeding
  // unless we remove the prior request first.
  const d = await supabaseAdmin
    .from('chat_requests')
    .delete()
    .eq('sender_id', demoId)
    .eq('receiver_id', user.id);
  if (d.error) throw new Error(`chat_requests clean: ${d.error.message}`);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 3);

  const ins = await supabaseAdmin.from('chat_requests').insert({
    sender_id: demoId,
    receiver_id: user.id,
    status: 'pending',
    date_status: 'pending',
    sender_name: demoSender.name,
    sender_photo_url: demoSender.photoURL,
    match_score: demoSender.score,
    reason: demoSender.reason,
    expires_at: expiresAt.toISOString(),
  });
  if (ins.error) throw new Error(`chat_requests insert: ${ins.error.message}`);

  return { success: true, senderId: demoId };
}

/**
 * DEV-ONLY. Delete any pending demo-sender invite to the current user.
 * Pairs with the DevPanel's "Stop fake invite" button so devs can disable
 * the auto-reseed behaviour when they're done with it.
 */
export async function devClearFakeInvites(): Promise<{ success: boolean }> {
  ensureDevToolsEnabled();

  const user = await verifyAuth();
  const DEMO_EMAIL = 'demo-sender@truevibe.dev';

  const list = await supabaseAdmin.auth.admin.listUsers();
  if (list.error) throw new Error(`listUsers: ${list.error.message}`);
  const demoId = list.data.users.find((u) => u.email === DEMO_EMAIL)?.id;
  if (!demoId) return { success: true }; // nothing to clear

  const d = await supabaseAdmin
    .from('chat_requests')
    .delete()
    .eq('sender_id', demoId)
    .eq('receiver_id', user.id);
  if (d.error) throw new Error(`chat_requests clean: ${d.error.message}`);

  return { success: true };
}

/**
 * DEV-ONLY. Clear the current user's profile back to a blank slate: wipes
 * personality, bot chat history, photo, bio, and top_matches.
 */
export async function devResetProfile(): Promise<{ success: boolean }> {
  ensureDevToolsEnabled();

  const user = await verifyAuth();
  const userId = user.id;

  const d1 = await supabaseAdmin.from('bot_chats').delete().eq('user_id', userId);
  if (d1.error) throw new Error(`bot_chats delete: ${d1.error.message}`);

  const d2 = await supabaseAdmin.from('personality_profiles').delete().eq('user_id', userId);
  if (d2.error) throw new Error(`personality_profiles delete: ${d2.error.message}`);

  const u = await supabaseAdmin
    .from('profiles')
    .upsert(
      {
        id: userId,
        email: user.email ?? '',
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
  if (u.error) throw new Error(`profiles upsert (reset): ${u.error.message}`);

  return { success: true };
}
