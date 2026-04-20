# Dev Tools — DELETE BEFORE PRODUCTION ROLLOUT

> **Anyone picking this up after the initial developer:** the folder
> `src/lib/dev-tools/` plus `src/components/dev/` plus a handful of inline
> blocks listed below exist **only to speed up local testing**. They call no
> Gemini endpoints, burn no tokens, and must be removed before members see
> this build in production.

What the harness does:

- Flip `identity_verified` on/off so you can test the date-invite flow
  without running the real `/api/verify-identity` path.
- Seed a demo profile (personality, bio, fake matches) so downstream
  features have content without chatting through Vera.
- Reset a profile back to a blank slate.

> ℹ️ **This file lives at `docs/dev-tools-deletion-guide.md`** on purpose — so
> that running `rm -rf src/lib/dev-tools/` doesn't delete the guide you're
> following. The pointer stub at `src/lib/dev-tools/README.md` will be
> removed along with the rest of that folder; this file stays put.

---

## Quick deletion — one command + 3 small edits

Run this from the repo root first. It wipes everything self-contained:

```bash
rm -rf src/lib/dev-tools/ src/components/dev/
```

Then the three scattered sites that import from the folders above must have
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
- `src/lib/dev-tools/fixtures/fake-matches.ts` — 5 fake match cards
- `src/lib/dev-tools/README.md` — the pointer stub to this guide
- `src/components/dev/DevPanel.tsx` — the yellow floating dev panel

### 2. ✅ `src/app/bot/actions.ts`

Delete the whole file — none of the exports (`devSetVerified`,
`devSeedDemoProfile`, `devResetProfile`) are used outside the dev panel.
If the file is imported elsewhere in the future, delete only the three
dev functions and keep the non-dev exports.

### 3. ✅ `src/app/bot/page.tsx`

Delete these imports:

```ts
import { DevPanel } from '@/components/dev/DevPanel';
```

Delete the `devPanelOpen` state line:

```ts
const [devPanelOpen, setDevPanelOpen] = useState(false);
```

Delete the Ctrl+1 keyboard listener `useEffect` (search for the comment
`DEV-ONLY: Ctrl+1 / Cmd+1` — delete the whole block).

Delete the profile-completed-but-no-photo `useEffect` block (search for
`dev-seeded accounts` — delete the whole `useEffect(() => { if
(profile?.profile_completed && !profile?.photo_url) { ... } }, [...]);`
block). Real members never hit that state because Vera's
`requestPhotoUpload` signal drives the 📎 button on its own.

In the component's JSX return (near the end), delete this line:

```tsx
{devPanelOpen && <DevPanel verified={isVerified} onClose={() => setDevPanelOpen(false)} />}
```

Also delete the now-unused `isVerified` line near the top of the component.

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

### 6. ✅ Verify nothing references the deleted symbols

```bash
npm run typecheck
npm run lint
npm run build
```

All three must pass. If any complains about `@/lib/dev-tools/*` or
`@/components/dev/*` or `devSetVerified` — a reference slipped through.
Search the repo:

```bash
grep -rn "dev-tools\|DevPanel\|devSetVerified\|devSeedDemoProfile\|devResetProfile\|devPanelOpen" src/
```

Expected output: no matches. If anything comes back, delete that too.

### 7. ✅ Spot-check in the browser

```bash
npm run dev
```

- Open `/bot` — pressing **Ctrl+1** (or Cmd+1) does nothing; no yellow panel appears.
- Open `/matches` as a fresh user — empty state card "Matches will appear here".
- Chat with Vera naturally — she asks basics, asks for a photo (📎 button appears), and on one turn returns a drafted bio that opens the bio modal.
- No console errors mentioning missing modules.

---

## What you kept (the actual features)

After running the checklist, these files should still exist and work
normally. Do **not** delete any of these:

- `src/ai/flows/ai-personality-interview.ts` — Vera's schema with `suggestedBio` / `requestPhotoUpload` and the prompt that drives them.
- `src/components/BioApprovalModal.tsx` — the modal itself (minus the dev-cache branch inside).
- `src/app/bot/page.tsx` — all production wiring; the 📎 button and bio modal trigger remain.
- `src/app/matches/page.tsx` — `/matches` gates the **Date Invite** button on `identity_verified`.
- `src/app/requests/page.tsx` — `/requests` gates **Accept Date** on `identity_verified`.

---

## How to open the dev panel (while it still exists)

1. In any environment (local `npm run dev`, Vercel preview, or production),
   go to **`/bot`** and press **Ctrl+1** (or **Cmd+1** on macOS). A yellow
   floating panel appears in the bottom-right corner. Press Ctrl+1 again
   (or click **×**) to hide it.

2. For the panel's buttons to actually mutate state, the server must have:

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

3. Buttons on the panel:

   - **Mark verified / Mark unverified** — toggles `identity_verified` +
     `verification_status` so you can exercise the Date Invite / Accept Date
     paths without going through the real `/api/verify-identity` flow.
   - **Seed demo profile** — writes tester fixtures (personality, bio, fake
     matches) to the current user. Leaves `photo_url` empty so the upload
     flow is still testable.
   - **Reset profile** — wipes personality, bot chat, bio, photo, and
     top matches back to a blank slate.
   - **Clear AI cache** — drops the `localStorage` cache that remembers
     Vera's drafted bio (saves tokens while iterating).
