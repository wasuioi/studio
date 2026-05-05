# Post-Date Feedback — design

**Date:** 2026-05-05
**Branch:** `worktree-feat+post-date-feedback`
**Source ticket:** Notion · "Post Date Feedback" · True Vibe project

## Goal

Collect structured feedback from a user about a planned date that has occurred, store it in the database, and stop. **No AI consumer, no profile updates, no surfacing back to the user** — that work is a future ticket. This iteration is pure data collection so we can accumulate real samples before designing the consumer.

## User flow

1. **/requests page** — A `chat_request` with `date_status='planned'` whose `scheduled_at` has passed shows a `<PostDateButton>` labelled "I went on this date". Both sender and receiver see this button on their respective views.
2. **Manual path** — User clicks the button → router pushes to `/bot` and opens a post-date check-in session for that date. Vera sends the first nudge content immediately.
3. **Auto-fallback path** — If the user has not engaged within 24h after `scheduled_at`, an hourly Vercel Cron creates a `date_feedback` row with `status='nudged'` and inserts the first-nudge messages into `bot_chats` so the next time the user opens `/bot` (or receives a push notification — out of scope for v1) they see Vera's check-in.
4. **Second nudge** — If the first-nudge `date_feedback` row remains `status='nudged'` 48h after `scheduled_at`, the same cron sends a softer second-nudge message (mockup content: "Still thinking about your date — no pressure...") with two pills: `It went well` and `I'd rather not say`.
5. **No third nudge.** After the second nudge fires, the system waits indefinitely. The flow is **resumable** while `status` is `nudged` or `in_progress` — if the user replies on day 5 or day 30, `aiPostDateCheckIn` picks up using the existing `date_feedback.conversation` array as state. Once the row reaches a terminal state (`completed` or `dismissed`), further user input from the post-date UI is rejected; the conversation renders read-only.
6. **In Vera DM** —
   - Open bubble: _"How did it go? Even just a word."_
   - `<PostDateCheckInCard>` with 3 pills (`It was great` / `Not sure yet` / `Not a match`) plus a free-text input.
   - User picks a pill or types text → call `aiPostDateCheckIn` server action.
   - Vera generates one LLM-driven follow-up question grounded in the user's input (capped at 2 follow-up turns total, hard-coded in the prompt).
   - User answers.
   - Vera generates a warm closer.
   - On closer: set `date_feedback.status='completed'`, `chat_requests.date_status='completed'`.
7. **"I'd rather not say"** — User clicks this pill on the second nudge → `date_feedback.status='dismissed'` + Vera replies "Completely understood. I won't ask again about this one." Terminal state, no further nudges.

### Status transitions

| From | To | Trigger |
| ---- | -- | ------- |
| (no row) | `nudged` | Cron fires first nudge for an eligible date |
| (no row) | `in_progress` | User clicks the manual `<PostDateButton>` |
| `nudged` | `nudged` (with `nudge_count=2`) | Cron fires second nudge at +48h |
| `nudged` | `in_progress` | User opens the badge / route and submits any content (pill or text) |
| `in_progress` | `completed` | Vera produces a closer (`isClosingTurn=true`) |
| `in_progress` | `dismissed` | User clicks "I'd rather not say" on the second-nudge card while the conversation is still in early state |
| `nudged` | `dismissed` | Same as above — direct from second-nudge card |
| `completed` / `dismissed` | (no transitions) | Terminal |

## Data model

### New table — `date_feedback`

```sql
create table public.date_feedback (
  id uuid primary key default gen_random_uuid(),
  chat_request_id uuid not null references public.chat_requests(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,

  -- The pill chosen on the first or second nudge. Null if user only typed
  -- free text without picking, or hasn't responded yet.
  pill_choice text check (pill_choice in ('positive','neutral','negative','dismissed')),

  -- Full Vera/user back-and-forth for this date's check-in. Stored here
  -- (not in bot_chats) so the personality interview transcript stays
  -- separate from per-date check-ins.
  -- Shape: [{role: 'vera' | 'user', text: string, ts: timestamptz}]
  conversation jsonb not null default '[]'::jsonb,

  status text not null default 'nudged'
    check (status in ('nudged','in_progress','completed','dismissed')),

  -- Which auto-nudge the row is currently parked on (1 or 2). Manual-button
  -- starts skip nudges and go straight to in_progress, leaving this null.
  nudge_count int,

  first_nudged_at timestamptz,
  second_nudged_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- One feedback row per (date, user). Each side gives feedback independently.
  unique (chat_request_id, user_id)
);

-- RLS: a user can read/write only their own feedback rows.
alter table public.date_feedback enable row level security;

create policy "Users can read their own feedback"
  on public.date_feedback for select
  using (auth.uid() = user_id);

create policy "Users can insert their own feedback"
  on public.date_feedback for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own feedback"
  on public.date_feedback for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

The cron writes through the service-role admin client, which bypasses RLS — no special policy needed for cron writes.

### `chat_requests` changes

```sql
alter table public.chat_requests
  add column if not exists scheduled_at timestamptz;

comment on column public.chat_requests.scheduled_at is
  'Proper timestamptz for the planned date. Source of truth for the post-date feedback cron. Existing suggested_date_time is kept for display.';
```

`scheduled_at` is populated by `SenderDatePlannerModal` when the sender confirms the final plan — at the point where it currently sets `date_status='planned'`, it now also writes `scheduled_at` parsed from the form's date/time inputs. If the modal currently uses a free-form text input, it gains a proper `<input type="datetime-local">` (or splits into date + time fields) so we get a parseable value.

`date_status` already accepts free-form text in the existing schema, so no constraint changes are needed; the code starts writing the value `'completed'` for finished feedback rounds.

### Privileged column lockdown

`date_feedback.status` and `pill_choice` should not be settable from the browser client outside of the documented flow. Migration `007` already locked privileged columns on `profiles`; we apply the same pattern: revoke column-level UPDATE on `status`, `pill_choice`, `nudge_count`, `first_nudged_at`, `second_nudged_at`, `completed_at` from the `authenticated` and `anon` roles, allowing writes only via the service-role admin client (cron + AI flow). The `started_at` and `conversation` fields stay user-writable so the in-progress chat can persist.

## AI flow — `aiPostDateCheckIn`

New file: `src/ai/flows/post-date-check-in.ts`. Mirrors `aiPersonalityInterview` in shape:

- `'use server'` directive
- Genkit + Gemini 2.5 Flash via the shared `ai` instance from `src/ai/genkit.ts`
- Input schema: `{ pillChoice?: 'positive'|'neutral'|'negative'|'dismissed', conversation: ChatTurn[], match: { name, photoUrl }, dateMeta: { suggestedLocation, suggestedDateTime }, preferredLanguage? }`
- Output schema: `{ response: string, isClosingTurn: boolean }`
- Prompt instructs Vera to: ask one short follow-up grounded in the user's last input; cap total follow-up turns at 2; produce a warm 1-line closer when ready; respect language preference; never lecture, judge, or recommend matches.

The flow is dumb about state — it just generates the next reply given the context. The server action wrapper persists the user message + Vera response into `date_feedback.conversation` and flips `status` based on `isClosingTurn`.

## Server actions / API routes

- `src/app/post-date/actions.ts` (new):
  - `startManualCheckIn(chatRequestId)` — called when the user clicks the manual button. Verifies the user is sender or receiver, creates the `date_feedback` row with `status='in_progress'`, seeds `conversation` with Vera's open bubble, returns the new row.
  - `submitCheckInTurn(feedbackId, userText, pillChoice?)` — appends user turn, calls `aiPostDateCheckIn`, appends Vera turn, updates `status` if Vera signalled `isClosingTurn`.
  - `dismissCheckIn(feedbackId)` — sets `status='dismissed'`, `pill_choice='dismissed'`, appends Vera's "Completely understood..." closer.
  - All three use `verifyAuth()` and own-row ownership checks via the user-context server client (RLS-enforced).

- `src/app/api/post-date-nudge/route.ts` (new): the cron target.
  - Header-checks `Authorization: Bearer ${process.env.CRON_SECRET}` (Vercel Cron sends this).
  - Uses `supabaseAdmin` to find `chat_requests` rows with `date_status='planned'` and `scheduled_at` set, joined against `date_feedback`, deciding for each (request, user) side: send first nudge / send second nudge / skip.
  - Sends nudges by inserting/updating the `date_feedback` row and seeding the conversation with Vera's nudge text.
  - Returns `{ processed: number, sentFirst: number, sentSecond: number }` for observability.

`vercel.json` (new at repo root, since the project doesn't have one yet):

```json
{
  "crons": [
    { "path": "/api/post-date-nudge", "schedule": "0 * * * *" }
  ]
}
```

`CRON_SECRET` is added to the env-var list (server-only, never `NEXT_PUBLIC_*`).

## Components

- **`src/components/PostDateButton.tsx`** — Renders on a `chat_requests` row when `date_status='planned'` and `scheduled_at < now()`. Calls `startManualCheckIn`, then routes to `/bot?postDate=<feedbackId>`.
- **`src/components/PostDateBadge.tsx`** — Renders on a row when a `date_feedback` row exists with `status in ('nudged','in_progress')`. Acts as a passive reminder; clicking opens `/bot?postDate=<feedbackId>` like the button.
- **`src/components/PostDateCheckInCard.tsx`** — The check-in card: match avatar, three sentiment pills, free-text input. Used inside the `/bot` page when the URL carries `?postDate=...`. Reuses `Button` / `Avatar` shadcn primitives and the project's existing color tokens.

The `/bot/page.tsx` parses the `postDate` query param. When present, it renders the post-date conversation (the `date_feedback.conversation` array) instead of the personality interview, and routes user input through `submitCheckInTurn` instead of the existing personality-interview action.

**Badge click behavior** — `<PostDateBadge>` resolves the existing `date_feedback.id` for the current user and chat_request via a small client-side query, then routes to `/bot?postDate=<id>`. Same final destination as the manual button, just opening an existing row instead of creating a new one.

## Scheduling logic

The cron handler runs hourly. For each `chat_request` it considers:

| State | Condition | Action |
| ----- | --------- | ------ |
| Eligible for first nudge | `date_status='planned'` AND `scheduled_at < now() - interval '24h'` AND no `date_feedback` row yet for this user | Insert `date_feedback` row with `status='nudged'`, `nudge_count=1`, `first_nudged_at=now()` and seed Vera's open bubble |
| Eligible for second nudge | `date_feedback.status='nudged'` AND `nudge_count=1` AND `scheduled_at < now() - interval '48h'` | Update row: `nudge_count=2`, `second_nudged_at=now()`, append Vera's softer second-nudge message |
| Otherwise | (responded, completed, dismissed, or already at `nudge_count=2`) | Skip |

Each side of a date is independent — sender and receiver each get their own row and their own nudges based on their own engagement.

## Dev-tool extension

Existing `src/components/dev/DevPanel.tsx` gets two new buttons under a new "Post-date feedback" section. Server actions live in `src/app/bot/actions.ts` alongside the others, all gated by `ensureDevToolsEnabled()`:

- **Seed past date** — `devSeedPastDate()`: reuses `devSeedFakeInvite`'s demo-sender mechanism but creates the `chat_request` with `status='accepted'`, `date_status='planned'`, `scheduled_at = now() - 25h`, plus a few `suggested_date_time` / `suggested_location` strings. Result: the manual button is immediately visible on `/requests` and the row is one cron tick away from receiving a first nudge.
- **Fire post-date nudges now** — `devFirePostDateNudgesNow()`: invokes the same logic as `/api/post-date-nudge` against the current user's eligible rows, bypassing the hourly cron. Useful for end-to-end testing of the auto path without waiting.

Both deletable along with the rest of the dev tools — entries get added to `src/lib/dev-tools/README.md`.

## Out of scope (explicitly)

- No AI consumer for the stored feedback (no automatic persona / ideal_partner / matching updates) — future ticket.
- No surfacing of profile changes back to users — Fela: silent storage only.
- No video-intro feature — future ticket; `chat_requests` stays offline-only for now.
- No third nudge — capped at two by design.
- No shortlist redirect card or learning card from the mockup — out of scope for v1.
- No push notifications / email — auto-nudge is in-app only; user discovers it next time they open the bot.

## Edge cases

- **Date cancelled** — If `chat_requests.status` becomes anything other than `accepted`, the cron filter excludes it and the manual button is hidden. No feedback collected.
- **User opens `/bot` mid-personality-interview** — The personality interview takes precedence; if both an unfinished interview and an active `postDate` query param exist, surface the post-date check-in (because the URL is explicit) but keep the interview's `bot_chats` row untouched.
- **Both sides give feedback** — Two independent `date_feedback` rows, no cross-talk.
- **Either side closes the date as `dismissed`** — Other side's flow is unaffected.
- **Late reply (resumability)** — `aiPostDateCheckIn` reads the full `conversation` array and synthesises the next turn. There is no "this date is too old to talk about" cutoff. If the user responds 30 days later, Vera replies normally. The prompt explicitly instructs Vera to acknowledge the time gap gracefully if the gap is large.
- **Conversation grows unboundedly** — Capped at 12 turns total per `date_feedback` row, enforced in `submitCheckInTurn` (server-side guard, not in the prompt). When the cap is reached, the server appends a fixed warm closer ("Thanks for sharing 💜 — this helps me get to know you.") and flips status to `completed`, regardless of what the LLM proposed for that turn.

## Migration ordering

1. New SQL migration file `supabase/migrations/013_post_date_feedback.sql`:
   1. `alter table chat_requests add column scheduled_at timestamptz`
   2. `create table date_feedback (...)`
   3. RLS policies on `date_feedback`
   4. Column-level revokes for privileged fields
2. Regenerate `src/lib/database.types.ts` (manual edit since types are hand-maintained per CLAUDE.md).
3. Implement code changes, in any order: AI flow, server actions, cron route, components, dev tools.

## Effort estimate

About one focused day:
- Migration + types: 30 min
- AI flow + prompt iteration: 2 hr
- Server actions + cron route: 2 hr
- UI components + `/bot` integration + `/requests` button: 2 hr
- Dev-tool buttons + manual end-to-end test: 1 hr

## Verification plan

After each implementation slice, run `npm run typecheck && npm run lint`. Manual end-to-end test with the dev-tool buttons:

1. Click "Seed past date" in dev panel → check that `<PostDateButton>` appears on `/requests` for the seeded row.
2. Click the button → `/bot?postDate=…` opens, Vera shows open bubble + check-in card.
3. Click each pill (positive / neutral / negative) on separate seeded dates and verify the LLM follow-ups feel grounded.
4. Type a free-text response only (no pill) → flow still works.
5. Click "Fire post-date nudges now" without engaging → first nudge appears in Vera DM + badge appears on `/requests` row.
6. Wait 48h equivalent — re-seed with `scheduled_at = now() - 49h` and a `nudge_count=1` row → fire again → second nudge appears.
7. Click "I'd rather not say" → status flips to `dismissed`, Vera responds with the closer, no further nudges.
8. Reload `/bot?postDate=…` mid-conversation → state restores from `date_feedback.conversation`.
