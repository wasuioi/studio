-- 005_application_extensions.sql
-- Extra columns discovered during feature-page migration.
-- These exist because the TrueVibe app stores richer data than the core
-- schema in migration 001. We'd normally split into separate tables
-- (date_plans, matching_results) but for v0 we keep them denormalized
-- on the existing rows so the feature pages work with minimal refactoring.

-- =========================================================================
-- profiles — add location, legacy personality_profile JSON, top_matches JSON
-- =========================================================================
alter table public.profiles
  add column if not exists location text,
  add column if not exists personality_profile jsonb,
  add column if not exists top_matches jsonb;

comment on column public.profiles.personality_profile is
  'Legacy embedded personality JSON (user_persona, ideal_partner, psychological_insights). The normalized personality_profiles table is preferred for new code.';
comment on column public.profiles.top_matches is
  'Cached list of top match objects from the find-matches AI flow. Replaces Firestore field.';

-- =========================================================================
-- chat_requests — add the rich denormalized fields used by the date-invite flow
-- =========================================================================
alter table public.chat_requests
  add column if not exists match_score         int,
  add column if not exists reason              text,
  add column if not exists date_status         text,
  add column if not exists sender_name         text,
  add column if not exists sender_photo_url    text,
  add column if not exists receiver_name       text,
  add column if not exists expires_at          timestamptz,
  add column if not exists payment_intent_id   text,
  add column if not exists suggested_date_time text,
  add column if not exists suggested_location  text;

comment on column public.chat_requests.date_status is
  'One of: pending, waiting_sender, planned, completed. Tracks the date-planning flow after a request is accepted.';
