# Dev Tools — DELETE BEFORE PRODUCTION ROLLOUT

> **Anyone picking this up after the initial developer:** this entire folder
> (`src/lib/dev-tools/`) plus `src/components/dev/` plus a handful of inline
> blocks listed below exist **only to speed up local testing of the staged
> interview**. They call no Gemini endpoints, burn no tokens, and must be
> removed before members see this build in production.

The staged-interview feature itself is real and shippable. What you are
deleting is the developer harness that seeds fixture data and lets you jump
between stages without chatting with Vera.

---

## Quick deletion — one command + 4 small edits

Run this from the repo root first. It wipes everything self-contained:

```bash
rm -rf src/lib/dev-tools/ src/components/dev/
```

Then the four scattered sites that import from the folders above must have
their imports + dev branches removed. Each site is short and marked with
clear boundaries.

---

## Checklist

### 1. ✅ Run `rm -rf src/lib/dev-tools/ src/components/dev/`

Deletes all of these in one go:

- `src/lib/dev-tools/flag.ts` — `isDevToolsEnabled()` env flag
- `src/lib/dev-tools/response-cache.ts` — localStorage cache for AI outputs
- `src/lib/dev-tools/fixtures/tester-profile.ts` — Alex Tester seed
- `src/lib/dev-tools/fixtures/tester-personality.ts` — personality fixture
- `src/lib/dev-tools/fixtures/tester-bio.ts` — pre-written bio
- `src/lib/dev-tools/fixtures/tester-conversation.ts` — fake chat history
- `src/lib/dev-tools/fixtures/fake-matches.ts` — 5 fake match cards (Mila, Dao, Noah, Pim, Ari)
- `src/lib/dev-tools/README.md` — this file
- `src/components/dev/DevStagePanel.tsx` — the yellow floating dev panel

### 2. ✅ `src/app/bot/actions.ts`

Delete these imports from the top of the file:

```ts
import { TESTER_PROFILE } from '@/lib/dev-tools/fixtures/tester-profile';
import { TESTER_PERSONALITY } from '@/lib/dev-tools/fixtures/tester-personality';
import { TESTER_BIO } from '@/lib/dev-tools/fixtures/tester-bio';
import { TESTER_CONVERSATION } from '@/lib/dev-tools/fixtures/tester-conversation';
import { FAKE_MATCHES } from '@/lib/dev-tools/fixtures/fake-matches';
```

Delete the entire `devForceStage` function (the whole `export async function
devForceStage(...) { ... }` block, from its JSDoc comment down to its closing
brace).

**Keep `updateUserStage` — that's the production Server Action that writes
the stage column after Vera advances a member.**

### 3. ✅ `src/app/bot/page.tsx`

Delete these imports:

```ts
import { DevStagePanel } from '@/components/dev/DevStagePanel';
import { isDevToolsEnabled } from '@/lib/dev-tools/flag';
```

Delete the dev-skip `useEffect` block (search for the comment `Dev-skip
scenario` — delete the whole `useEffect(() => { ... }, [profile?.stage,
profile?.photo_url]);` block including the comment above it). Real members
never hit that state because Vera's `requestPhotoUpload` signal drives the
📎 button on its own.

In the component's JSX return (near the end), delete this line:

```tsx
{isDevToolsEnabled() && <DevStagePanel currentStage={stage} />}
```

**Leave `<BioApprovalModal ... />` — that's production code.**

### 4. ✅ `src/components/BioApprovalModal.tsx`

Delete these imports:

```ts
import { isDevToolsEnabled } from '@/lib/dev-tools/flag';
import { getCached, setCached } from '@/lib/dev-tools/response-cache';
```

Inside `useEffect(() => { ... }, [open, initialBio]);`, delete the dev-cache
branch (the `if (isDevToolsEnabled()) { ... }` block). The useEffect should
end up as just:

```ts
useEffect(() => {
  if (!open) return;
  setBio(initialBio);
}, [open, initialBio]);
```

### 5. ✅ Environment variables

Remove from local `.env.local`:

```
NEXT_PUBLIC_ENABLE_DEV_TOOLS=true
ENABLE_DEV_TOOLS=true
```

Check Vercel project settings (Preview **and** Production) for the same two
keys and remove them if present. They should never have been set in
production, but double-check. You can do this from the Vercel dashboard
under **Settings → Environment Variables**, or via the CLI:

```bash
vercel env ls
vercel env rm NEXT_PUBLIC_ENABLE_DEV_TOOLS production
vercel env rm ENABLE_DEV_TOOLS production
# …and same for preview if set
```

### 6. ✅ Verify nothing references the deleted symbols

```bash
npm run typecheck
npm run lint
npm run build
```

All three must pass. If any complains about `@/lib/dev-tools/*` or
`@/components/dev/*` or `devForceStage` — a reference slipped through.
Search the repo:

```bash
grep -rn "dev-tools\|DevStagePanel\|isDevToolsEnabled\|devForceStage" src/
```

Expected output: no matches. If anything comes back, delete that too.

### 7. ✅ Spot-check in the browser

```bash
npm run dev
```

- Open `/bot` — **no yellow DEV TOOLS panel** in the corner.
- Open `/matches` as a fresh user — empty state card "Matches will appear here".
- Open `/profile` as a fresh user — empty state "Let's finish your introduction first".
- Chat with Vera naturally — she asks basics, then a photo (📎 button appears), then advances to stage 1 and the bio modal opens.
- No console errors mentioning missing modules.

---

## What you kept (the actual feature)

After running the checklist, these files should still exist and work
normally. Do **not** delete any of these:

- `supabase/migrations/008_add_stage_tracking.sql` — `profiles.stage` and `profiles.bio` columns + the REVOKE that locks stage from browser writes.
- `src/lib/feature-gates.ts` — `canUse(feature, stage)` helper.
- `src/lib/database.types.ts` — types include `stage` and `bio` on profiles.
- `src/ai/flows/ai-personality-interview.ts` — Vera's schema with `stageReached` / `suggestedBio` / `requestPhotoUpload` and the prompt that drives them.
- `src/app/bot/actions.ts` — `updateUserStage` (but NOT `devForceStage`).
- `src/components/BioApprovalModal.tsx` — the modal itself (minus the dev-cache branch inside).
- `src/app/bot/page.tsx` — all production wiring; the 📎 button, stage progression, and bio modal trigger remain.
- `src/app/matches/page.tsx` — stage gating on match browse + Date Invite button.
- `src/app/profile/page.tsx` — pre-stage-1 empty state.
- `src/app/requests/page.tsx` — stage gating on Accept Date.

---

## Env vars while developing (do not commit these to git)

While you are still testing locally and want the harness on, keep these in
`.env.local`:

```
NEXT_PUBLIC_ENABLE_DEV_TOOLS=true
ENABLE_DEV_TOOLS=true
```

Both must be `true` for the panel to **render** and for `devForceStage` to
**actually mutate state**. If either is missing, the panel silently does
nothing — which is the intended fail-closed behaviour for any accidentally
deployed build.
