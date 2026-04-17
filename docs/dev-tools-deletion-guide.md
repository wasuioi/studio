# Dev Tools — DELETE BEFORE PRODUCTION ROLLOUT

> **Anyone picking this up after the initial developer:** the folder
> `src/lib/dev-tools/` plus `src/components/dev/` plus a handful of inline
> blocks listed below exist **only to speed up local testing of the staged
> interview**. They call no Gemini endpoints, burn no tokens, and must be
> removed before members see this build in production.

The staged-interview feature itself is real and shippable. What you are
deleting is the developer harness that seeds fixture data and lets you jump
between stages without chatting with Vera.

> ℹ️ **This file lives at `docs/dev-tools-deletion-guide.md`** on purpose — so
> that running `rm -rf src/lib/dev-tools/` doesn't delete the guide you're
> following. The pointer stub at `src/lib/dev-tools/README.md` will be
> removed along with the rest of that folder; this file stays put.

---

## Quick deletion — one command + 4 small edits

Run this from the repo root first. It wipes everything self-contained:

```bash
rm -rf src/lib/dev-tools/ src/components/dev/
```

(This also deletes the pointer stub at `src/lib/dev-tools/README.md` — that's
fine, the authoritative guide is this file in `docs/`.)

Then the four scattered sites that import from the folders above must have
their imports + dev branches removed. Each site is short and marked with
clear boundaries.

---

## Checklist

### 1. ✅ Run `rm -rf src/lib/dev-tools/ src/components/dev/`

Deletes all of these in one go:

- `src/lib/dev-tools/response-cache.ts` — localStorage cache for AI outputs
- `src/lib/dev-tools/fixtures/tester-profile.ts` — Alex Tester seed
- `src/lib/dev-tools/fixtures/tester-personality.ts` — personality fixture
- `src/lib/dev-tools/fixtures/tester-bio.ts` — pre-written bio
- `src/lib/dev-tools/fixtures/tester-conversation.ts` — fake chat history
- `src/lib/dev-tools/fixtures/fake-matches.ts` — 5 fake match cards (Mila, Dao, Noah, Pim, Ari)
- `src/lib/dev-tools/README.md` — the pointer stub to this guide
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

Delete this import:

```ts
import { DevStagePanel } from '@/components/dev/DevStagePanel';
```

Delete the `devPanelOpen` state line:

```ts
const [devPanelOpen, setDevPanelOpen] = useState(false);
```

Delete the Ctrl+1 keyboard listener `useEffect` (search for the comment
`DEV-ONLY: Ctrl+1 / Cmd+1` — delete the whole block).

Delete the dev-skip `useEffect` block (search for the comment `Dev-skip
scenario` — delete the whole `useEffect(() => { ... }, [profile?.stage,
profile?.photo_url]);` block including the comment above it). Real members
never hit that state because Vera's `requestPhotoUpload` signal drives the
📎 button on its own.

In the component's JSX return (near the end), delete this line:

```tsx
{devPanelOpen && <DevStagePanel currentStage={stage} onClose={() => setDevPanelOpen(false)} />}
```

**Leave `<BioApprovalModal ... />` — that's production code.**

### 4. ✅ `src/components/BioApprovalModal.tsx`

Delete this import:

```ts
import { getCached, setCached } from '@/lib/dev-tools/response-cache';
```

Inside `useEffect(() => { ... }, [open, initialBio]);`, delete the
bio-cache block (the lines that call `getCached` / `setCached`). The
useEffect should end up as just:

```ts
useEffect(() => {
  if (!open) return;
  setBio(initialBio);
}, [open, initialBio]);
```

### 5. ✅ Environment variables

Remove from local `.env.local` and any Vercel environment (Preview **and**
Production):

```
ENABLE_DEV_TOOLS=true
```

```bash
vercel env ls
vercel env rm ENABLE_DEV_TOOLS production
vercel env rm ENABLE_DEV_TOOLS preview
```

(Earlier revisions also used `NEXT_PUBLIC_ENABLE_DEV_TOOLS` — that one was
removed when the panel moved to the Ctrl+1 keybind. If you still see it in
any Vercel environment, remove it.)

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
grep -rn "dev-tools\|DevStagePanel\|devForceStage\|devPanelOpen" src/
```

Expected output: no matches. If anything comes back, delete that too.

### 7. ✅ Spot-check in the browser

```bash
npm run dev
```

- Open `/bot` — pressing **Ctrl+1** (or Cmd+1) does nothing; no yellow panel appears.
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

## How to open the dev panel (while it still exists)

1. In any environment (local `npm run dev`, Vercel preview, or the yellow
   panel is even harmlessly mountable on production), go to **`/bot`** and
   press **Ctrl+1** (or **Cmd+1** on macOS). A yellow floating panel
   appears in the bottom-right corner. Press Ctrl+1 again (or click **×**)
   to hide it.

2. For the panel's buttons (`Skip to 1`, `Skip to 2`, `Reset to stage 0`)
   to actually mutate state, the server must have:

   ```
   ENABLE_DEV_TOOLS=true
   ```

   Set this in `.env.local` for local dev and in Vercel **Preview**
   environment if you want to drive a preview deployment:

   ```bash
   vercel env add ENABLE_DEV_TOOLS preview   # value: true
   ```

   On production (or anywhere this env is not `true`) the buttons show a
   red error toast instead of mutating the DB. That is the only real
   security gate — keybind + panel UI are harmless on their own because
   every privileged action runs through a Server Action that re-checks
   the env var.
