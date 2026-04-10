-- 007_lock_profile_privileged_columns.sql
-- Security hardening: prevent authenticated users from writing privileged
-- columns on their own profiles row via the browser Supabase client.
--
-- Background: the RLS policy "profiles_update_self" in 002_rls_policies.sql
-- allows an authenticated user to UPDATE any column on their own row. That
-- included `identity_verified` and `verification_status`, which meant an
-- attacker with a valid session could mark themselves as identity-verified
-- without ever going through the `/api/verify-identity` flow — simply by
-- opening DevTools and running:
--
--   await supabase.from('profiles')
--     .update({ identity_verified: true, verification_status: 'verified' })
--     .eq('id', user.id);
--
-- Postgres checks column-level UPDATE privileges against the columns named in
-- the SET clause of an UPDATE statement. By revoking UPDATE on these columns
-- from the `authenticated` (and `anon`) roles, we force all writes to these
-- fields to go through the service-role client, which is only reachable from
-- trusted server code (Route Handlers, Server Actions, AI flows). The RLS
-- policy continues to govern the remaining columns that users can legitimately
-- edit (display_name, bio, photo_url, location, etc.).
--
-- Note: BEFORE UPDATE triggers (like set_updated_at) can still set updated_at
-- without column-level UPDATE privilege, because Postgres only enforces
-- column privileges against columns named explicitly in the SET clause.

revoke update (identity_verified, verification_status, tier, email)
  on public.profiles
  from authenticated;

revoke update (identity_verified, verification_status, tier, email)
  on public.profiles
  from anon;

-- Follow-up (not in this migration to avoid breaking the bot flow):
-- `profile_completed` is currently written from src/app/bot/page.tsx as a
-- browser-side update after the Vera interview finishes. Once that write is
-- moved to a Server Action / Route Handler, we should add this column to the
-- revoke list too, so clients can never self-mark their profile as complete.
