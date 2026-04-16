# Dev Tools — DELETE BEFORE PRODUCTION DEPLOY

Everything under `src/lib/dev-tools/` and `src/components/dev/` is developer-only
infrastructure for testing the staged-interview flow without calling Gemini.

## What these folders contain

- `flag.ts` — `isDevToolsEnabled()` reads `NEXT_PUBLIC_ENABLE_DEV_TOOLS`.
- `response-cache.ts` — localStorage wrapper for cached AI outputs.
- `fixtures/` — static tester profile/personality/bio/conversation data.
- `../components/dev/DevStagePanel.tsx` — floating corner panel with Skip / Reset buttons.
- Server Action `devForceStage` in `src/app/bot/actions.ts` (delete that export too).

## Deletion checklist

1. `rm -rf src/lib/dev-tools/ src/components/dev/`
2. In `src/app/bot/actions.ts`: delete `devForceStage` export and any imports from
   `src/lib/dev-tools/`.
3. In `src/app/bot/page.tsx`: remove the `<DevStagePanel />` render, its import,
   and any `isDevToolsEnabled()` checks.
4. In `src/components/BioApprovalModal.tsx`: remove the dev-cache branch.
5. Remove `NEXT_PUBLIC_ENABLE_DEV_TOOLS` and `ENABLE_DEV_TOOLS` from `.env.local`
   and from Vercel env settings if anyone set them there.
6. Run `npm run typecheck && npm run lint` and fix any dangling imports.
7. Run `npm run dev` and confirm `/bot` loads normally without dev controls.

## Env vars (never commit these to git)

Put in `.env.local`:

```
NEXT_PUBLIC_ENABLE_DEV_TOOLS=true
ENABLE_DEV_TOOLS=true
```

Both must be `true` for the panel to both render *and* actually mutate state.
