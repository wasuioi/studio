# Staged Interview & Progressive Feature Gating

**Status:** Design approved 2026-04-16 — ready for implementation planning.

## Goal

Turn Vera's single-shot personality interview into a 3-stage journey where each stage progressively unlocks app features. The staging is **invisible to the member** — they never see "Stage 1 / 2 / 3" in the UI. They simply chat with Vera, and features appear when the conversation has covered enough ground.

Alongside the feature, ship a **developer-only test harness** that lets us jump to any stage without burning Gemini tokens — isolated in its own folder so it can be cleanly deleted before a production deploy.

## Stage definitions

| Stage | Coverage (internal only) | Features unlocked |
|---|---|---|
| **0** | Nothing yet | Vera chat only |
| **1** (~40%) | Basics, relationship goals, deal-breakers, profile photo | Browse curated matches, full profile page, bio suggestion modal |
| **2** (~75%) | Behavioural patterns, communication style, relationship history | Send + accept date invites |
| **3** (~100%) | Deeper preferences, childhood influences (when natural) | Vera's Instinct wild-card matches |

Vera decides when a stage has been covered. There is no fixed field checklist — the AI judges based on conversation quality.

## Non-goals

- Showing a progress bar, badge, or any "Stage N of 3" text to the member.
- Redirecting the member or blocking navigation — every page remains reachable. Only features appear/disappear.
- Replacing the existing identity-verification gate — that check (`profiles.identity_verified`) continues to run in parallel with the new stage gate.
- Rewriting Vera's existing 3-phase reasoning prompt. We extend the schema; we don't replace the strategy.

---

## Section 1 — Data model

New migration `supabase/migrations/008_add_stage_tracking.sql`:

```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stage INTEGER NOT NULL DEFAULT 0
  CHECK (stage BETWEEN 0 AND 3);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio TEXT;

-- Lock `stage` the same way migration 007 locked identity_verified.
REVOKE UPDATE (stage) ON profiles FROM authenticated, anon;
-- `bio` remains user-editable so the member can save/tweak Vera's suggestion directly.
```

**Why lock `stage`:** Without the column-level REVOKE, the browser Supabase client could `UPDATE profiles SET stage = 3` and self-promote. All stage writes must go through server code using `supabaseAdmin`.

Regenerate `src/lib/database.types.ts` after the migration is applied.

---

## Section 2 — Stage detection in Vera

**`src/ai/flows/ai-personality-interview.ts`** — extend the output Zod schema:

```ts
stageReached: z.enum(['none', 'stage1', 'stage2', 'stage3'])
  .describe(
    "The highest stage fully covered so far. Only promote when the data for that stage has genuinely been collected — never advance prematurely. Stay at the previous stage if in doubt."
  ),
suggestedBio: z.string().optional()
  .describe(
    "A 2-3 sentence bio in the member's own voice, only populated on the first turn where stageReached transitions to 'stage1'."
  ),
requestPhotoUpload: z.boolean()
  .describe(
    "Set true only on turns where you are explicitly asking the member to upload a profile photo. Do not set true if the profile already has a photo_url."
  ),
```

Extend Vera's system prompt with the stage coverage requirements (bullet list per stage matching the table above). **Critical guardrail:** the prompt must explicitly forbid Vera from ever saying "Stage", "level up", "unlocked", or "next phase" to the member. Stage reasoning stays internal.

**`src/app/bot/page.tsx`** — after each Vera response:

```ts
const stageMap = { none: 0, stage1: 1, stage2: 2, stage3: 3 } as const;
const newStage = stageMap[result.stageReached];
const previousStage = profile?.stage ?? 0;

if (newStage > previousStage) {
  await updateUserStage(newStage);
  if (previousStage < 1 && newStage >= 1 && result.suggestedBio) {
    setPendingBioDraft(result.suggestedBio);
    setBioModalOpen(true);
  }
}
```

**New file `src/app/bot/actions.ts`:**

- `updateUserStage(newStage: number)` — Server Action. Verifies the caller via `verifyAuth()`, asserts `newStage` is a valid number (1–3) and only moves forward (rejects attempts to downgrade), then uses `supabaseAdmin` to write `profiles.stage`. Returns `{ success: boolean }`.

The `suggestedBio` is **not** passed through the Server Action — the client already has it from Vera's response and feeds it straight into the modal. This keeps the action single-purpose.

(The dev-only `devForceStage` in Section 6 bypasses the forward-only check so it can reset to stage 0.)

---

## Section 3 — Photo upload in chat

The photo is part of Stage 1 coverage. Vera asks for it mid-conversation.

**UI (`src/app/bot/page.tsx`):**

- Show a 📎 upload button next to the chat input **only when** the latest Vera response has `requestPhotoUpload === true` **and** `profile.photo_url` is still null.
- Clicking it opens a hidden `<input type="file" accept="image/*">`.
- Upload to the existing `profile-photos` bucket under `{userId}/avatar-{timestamp}.{ext}`, reusing the pattern from `src/app/profile/page.tsx:108-168`.
- After success: `UPDATE profiles SET photo_url = <public-url>` (user-writable column, plain browser client is fine).
- Append a synthetic system turn to the chat history that Vera will see on her next turn:
  ```
  [System: User just uploaded their profile photo.]
  ```
- Vera's prompt already receives the current `profile.photo_url` in its context, so subsequent turns know the photo exists and won't re-ask.

**Why synthetic system turn:** directly answers the Notion task note "The AI should know that the picture has been uploaded". Vera acknowledges in natural language on the next turn and continues toward Stage 1 completion.

---

## Section 4 — Feature gating (invisible to members)

**`src/lib/feature-gates.ts`:**

```ts
export type Feature =
  | 'browse_matches'
  | 'view_profile_page'
  | 'send_date_invite'
  | 'accept_date_invite'
  | 'veras_instinct';

const REQUIRED_STAGE: Record<Feature, number> = {
  browse_matches: 1,
  view_profile_page: 1,
  send_date_invite: 2,
  accept_date_invite: 2,
  veras_instinct: 3,
};

export function canUse(feature: Feature, stage: number): boolean {
  return stage >= REQUIRED_STAGE[feature];
}
```

**Call sites:**

| File | Change |
|---|---|
| `src/app/matches/page.tsx` | Keep existing empty state; reword to remove any mention of "interview complete" → generic "Keep chatting with Vera to see matches". Hide the "Date Invite" button per card unless `canUse('send_date_invite', stage)`. Hide a future "Vera's Instinct" button unless `canUse('veras_instinct', stage)`. |
| `src/app/profile/page.tsx` | Show empty state "Finish your introduction with Vera first" when `stage < 1`. |
| `src/app/requests/page.tsx` | Hide the "Accept Date" button unless `canUse('accept_date_invite', stage)`. |
| `src/components/Navigation.tsx` | No change. Do not add a stage badge. Do not hide links. |

**Wording rules everywhere:**
- ❌ "Stage 1", "Stage 2", "Stage 3", "level up", "unlocked", "phase"
- ✅ "Keep chatting with Vera", "Finish your introduction", "Come back after a bit more conversation"

Buttons that are gated simply **do not render** rather than rendering disabled — the member never knows a button was hidden.

---

## Section 5 — Bio suggestion modal

**New component `src/components/BioApprovalModal.tsx`** — wraps shadcn `Dialog` + `Textarea`.

**Trigger:** `src/app/bot/page.tsx` opens the modal when `updateUserStage` response includes `justReachedStage === 1` and `suggestedBio` is non-empty.

**Props:**
```ts
interface BioApprovalModalProps {
  open: boolean;
  initialBio: string;
  onSave: (bio: string) => Promise<void>;
  onSkip: () => void;
}
```

**Flow:**
1. Modal opens with Vera's draft pre-filled in a textarea.
2. Member edits freely, then clicks "Looks good" → `UPDATE profiles SET bio = ...` via the browser client (column is user-writable). On success, close modal.
3. "Skip for now" → close modal without saving. Member can set a bio later from `/profile`.

**Copy:**
- Title: *"Your bio, drafted with Vera"*
- Body: *"Here's what I put together from our chat. Edit anything that doesn't feel like you."*
- Buttons: `[Looks good]` · `[Skip for now]`

**Dev cache integration:** When `isDevToolsEnabled()` is true, the modal first checks `localStorage['dev-cached-bio']`; if present, it overrides `initialBio` with the cached value. Otherwise it caches Vera's draft the first time it's shown. Cache is cleared by the dev panel's "Clear AI cache" button. (Production never runs this branch because `isDevToolsEnabled()` returns false.)

---

## Section 6 — Developer test harness

Two env vars, both **off by default**:

| Var | Scope | Purpose |
|---|---|---|
| `NEXT_PUBLIC_ENABLE_DEV_TOOLS` | Browser + server | Makes the dev panel render and the `isDevToolsEnabled()` helper return true. |
| `ENABLE_DEV_TOOLS` | Server only (no `NEXT_PUBLIC_` prefix) | Second gate inside the Server Action. If missing, the action throws even if someone calls it. |

Both must be `'true'` for dev tools to actually mutate state. On Vercel, neither is set → everything short-circuits.

**Folder layout (everything dev-only lives here so it can be deleted as a unit):**

```
src/lib/dev-tools/
├── flag.ts                      # isDevToolsEnabled()
├── fixtures/
│   ├── tester-profile.ts        # name, age 25, location "Bangkok", deal-breakers, …
│   ├── tester-personality.ts    # a believable personality_profile object
│   ├── tester-bio.ts            # pre-written bio, reused whenever caching is on
│   └── tester-conversation.ts   # array of {role, content} to populate bot_chats
├── response-cache.ts            # localStorage.getItem/setItem wrapper with 'dev-cached-*' keys
└── README.md                    # "DELETE THIS FOLDER BEFORE PRODUCTION DEPLOY"

src/components/dev/
└── DevStagePanel.tsx            # floating corner panel; renders only if isDevToolsEnabled()

src/app/bot/actions.ts
└── devForceStage(targetStage)   # dev-only Server Action next to updateUserStage()
```

**`DevStagePanel` controls:**

- `[Skip to Stage 1]` `[Skip to Stage 2]` `[Skip to Stage 3]` — each calls `devForceStage(N)`.
- `[Reset to Stage 0 (fresh user)]` — calls `handleResetConversation` (already exists in `src/app/bot/page.tsx:190-233`) plus resets `profiles.stage = 0` via `devForceStage(0)`.
- `[Clear AI cache]` — removes all `localStorage['dev-cached-*']` keys.
- Status line: `Current stage: N` + checkmarks showing which AI outputs are currently cached (`bio`, `personality`, `matches`).

**`devForceStage(N)` behavior:**

1. `if (process.env.ENABLE_DEV_TOOLS !== 'true') throw new Error('Dev tools disabled')` — double gate.
2. `verifyAuth()` — still requires a real logged-in session so we can only seed our own row.
3. Using `supabaseAdmin`:
   - Upsert `profiles` with tester-profile fixture fields + `stage = N` + bio from tester-bio fixture.
   - Upsert `personality_profiles` with tester-personality fixture (only if `N >= 1`).
   - Insert tester-conversation rows into `bot_chats` (only if current log is empty, to avoid dupes).
4. No Gemini calls anywhere in this flow — fixtures are static TypeScript objects.

**Wiring the panel:** in `src/app/bot/page.tsx` (not in `layout.tsx`, because we only need the panel while developing the bot/stage flow):

```tsx
{isDevToolsEnabled() && <DevStagePanel currentStage={profile?.stage ?? 0} />}
```

**Deletion checklist (to run before shipping stages to production):**

1. `rm -rf src/lib/dev-tools/ src/components/dev/`
2. In `src/app/bot/actions.ts`: delete the `devForceStage` export and the `fixtures` import.
3. In `src/app/bot/page.tsx`: remove the `<DevStagePanel />` render, its import, and any `isDevToolsEnabled()` checks.
4. In `src/components/BioApprovalModal.tsx`: remove the dev-cache branch (the production fall-through already exists).
5. Remove `NEXT_PUBLIC_ENABLE_DEV_TOOLS` and `ENABLE_DEV_TOOLS` from `.env.local` and any Vercel env settings.
6. Run `npm run typecheck && npm run lint` to confirm nothing references the deleted files.

---

## File change summary

| File | Kind | Notes |
|---|---|---|
| `supabase/migrations/008_add_stage_tracking.sql` | **new** | stage + bio columns, REVOKE on stage |
| `src/lib/database.types.ts` | edit | add `stage`, `bio` to `profiles` |
| `src/ai/flows/ai-personality-interview.ts` | edit | extend schema, tighten prompt |
| `src/app/bot/page.tsx` | edit | handle stageReached, photo upload button, open bio modal, mount DevStagePanel |
| `src/app/bot/actions.ts` | **new** | `updateUserStage`, `devForceStage` |
| `src/components/BioApprovalModal.tsx` | **new** | dialog for bio approval |
| `src/lib/feature-gates.ts` | **new** | `canUse(feature, stage)` helper |
| `src/app/matches/page.tsx` | edit | reword empty state, gate invite button, gate Vera's Instinct |
| `src/app/profile/page.tsx` | edit | empty state when stage < 1 |
| `src/app/requests/page.tsx` | edit | gate Accept button |
| `src/lib/dev-tools/**` | **new** (dev-only) | fixtures + cache + flag |
| `src/components/dev/DevStagePanel.tsx` | **new** (dev-only) | floating dev panel |

No changes to: `src/components/Navigation.tsx`, Supabase storage policies, RLS policies on other tables, identity-verification flow.

---

## Testing plan (manual — no test runner wired up)

With `NEXT_PUBLIC_ENABLE_DEV_TOOLS=true` and `ENABLE_DEV_TOOLS=true`:

1. Fresh signup → `/bot` → DevStagePanel visible → current stage = 0.
2. `[Skip to Stage 1]` → profile has bio + photo_url + personality_profile → `/matches` now shows fake matches → Date Invite button still hidden → `/profile` renders full page.
3. `[Skip to Stage 2]` → Date Invite button appears on `/matches` → Accept button appears on `/requests`.
4. `[Skip to Stage 3]` → Vera's Instinct button appears.
5. `[Reset to Stage 0]` → all features hidden again, chat cleared.
6. Send a real conversation with Vera (dev tools off in a separate browser profile) → stage advances naturally when Vera judges the coverage is there.
7. With dev tools **off** (production simulation): dev panel must not render, and calling `devForceStage` directly (e.g. via devtools console) must throw.

## Open issues / deferred

- The dev fixture `tester-personality.ts` needs to match the `personality_profiles` table shape exactly. Generate it once by running the real Vera flow end-to-end and capturing the DB row as TypeScript.
- Future: when dev tools are deleted, consider whether the `bio` column should be backfilled for early users who never saw the modal. Out of scope for this spec.
