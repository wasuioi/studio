-- Migration 008: add stage tracking + bio to profiles, lock stage from user writes
--
-- Adds two columns:
--   profiles.stage  -- 0..3, incremented by server only
--   profiles.bio    -- optional self-description suggested by Vera, editable by user
--
-- Mirrors the security pattern in migration 007: stage is revoked from the
-- authenticated / anon roles at column level so only service-role writes (via
-- supabaseAdmin) can advance it.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS stage INTEGER NOT NULL DEFAULT 0
    CHECK (stage BETWEEN 0 AND 3);

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS bio TEXT;

-- Block browser/anon clients from writing stage directly.
revoke update (stage) on public.profiles from authenticated;
revoke update (stage) on public.profiles from anon;
-- bio stays user-writable so the BioApprovalModal can save directly.
