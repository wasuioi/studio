-- Migration 011: drop profiles.stage
--
-- The staged-unlock system (chat-with-Vera-to-unlock-features) has been
-- removed. All members now see every feature, with identity verification
-- as the only gate on sending/accepting date invites.
--
-- profiles.bio stays — members still have a bio, Vera just no longer ties
-- it to a stage transition.

ALTER TABLE profiles DROP COLUMN IF EXISTS stage;
