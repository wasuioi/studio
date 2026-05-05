# Dev Tools — DELETE BEFORE PRODUCTION ROLLOUT

This folder and `src/components/dev/` are **developer-only** infrastructure
for testing downstream flows (date invites, matches) without calling Gemini
or running the real identity-verification path.

**Full deletion guide lives outside this folder** (so you can still read it
after running `rm -rf`):

👉 [`docs/dev-tools-deletion-guide.md`](../../../docs/dev-tools-deletion-guide.md)

Open that file first, then follow the checklist.

## Dev-only exports (gated by `ENABLE_DEV_TOOLS=true`)

- `devSetVerified` (`src/app/bot/actions.ts`) — toggles `identity_verified` + `verification_status` on the current user, bypassing `/api/verify-identity`.
- `devSeedDemoProfile` (`src/app/bot/actions.ts`) — seeds the current user's profile + personality + bot chat with the tester fixtures.
- `devResetProfile` (`src/app/bot/actions.ts`) — wipes the current user's personality, bot chat, bio, photo, and top_matches.
- `devSeedFakeInvite` (`src/app/bot/actions.ts`) — inserts a pending date invite from the demo-sender account so `/requests` has something to accept.
- `devClearFakeInvites` (`src/app/bot/actions.ts`) — deletes any demo-sender invite to the current user.
- `devSeedPastDate` (`src/app/bot/actions.ts`) — inserts a fake demo-sender chat_request with `scheduled_at = now() - 25h` so the post-date feedback button shows immediately on `/requests` and the cron-eligible window is crossed.
- `devFirePostDateNudgesNow` (`src/app/bot/actions.ts`) — runs the cron's nudge sweep against the current user's rows only, without going through `/api/post-date-nudge` or waiting for the hourly schedule.
- DevPanel buttons "Seed past date" and "Fire post-date nudges now" — UI surfaces for the two actions above.
