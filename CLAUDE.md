# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

All project files live at the git repository root. The Next.js app, Supabase config, and tooling are all at the top level — run every command below from the repo root.

**History note:** This codebase originated from `wasuioi/studio` (which nested the Next.js app under an inner `studio/` subdirectory and used a Firebase data layer). On 2026-04-10 two large rewrites landed together: the inner `studio/` directory was flattened into the repo root, and the entire Firebase stack (Auth, Firestore, Storage, Hosting) was replaced with Supabase (Auth, Postgres, Storage, Realtime). Stripe payments and the `UpgradeModal` flow were removed in the same pass. This repo is now a standalone project — there is no upstream to merge from. Use `git log` for the authoritative change history.

## Security
- Never put any important API keys, secrets, or credentials in frontend/client-side code, as they will be easily leaked to users. Always keep them on the server side only (e.g., environment variables accessed in API routes or server components). 

## Commands

```bash
# Install
npm install

# Dev server — Turbopack on port 9002 (NOT 3000)
npm run dev

# Genkit AI dev tooling (runs src/ai/dev.ts, which imports every flow)
npm run genkit:dev      # one-shot
npm run genkit:watch    # file-watch mode

# Production build / start
npm run build           # NODE_ENV=production next build
npm run start

# Lint + type-check
npm run lint
npm run typecheck       # tsc --noEmit
```

**Important:** `next.config.ts` sets `typescript.ignoreBuildErrors: true` and `eslint.ignoreDuringBuilds: true`. `npm run build` will succeed even when the code is broken — always run `npm run typecheck` and `npm run lint` explicitly to catch real errors.

There is no test runner wired up in `package.json`. Verification is manual.

## High-level architecture

TrueVibe is a Next.js 15 (App Router) + React 19 + TypeScript dating app. The core stack is **Supabase (Auth / Postgres / Storage / Realtime) on both client and server, Genkit (Google Gemini) for AI flows on the server, and Resend for email.** It deploys to Vercel only. Payments (previously Stripe) were removed on 2026-04-10 — feature may be reintroduced later; use `git log --follow -- src/components/UpgradeModal.tsx src/app/api/stripe` to find the pre-removal implementation.

### Client ⇄ server boundary

Three Supabase client surfaces — pick the right one for each use case:

- **Browser client (`src/supabase/client.ts`)** — `'use client'` modules use `supabase` exported from here. Built on `@supabase/ssr`'s `createBrowserClient`, so sessions live in cookies and are shared with server code. Singleton per browser session. `SupabaseProvider` wraps the entire app in `src/app/layout.tsx` and exposes auth state via `useSupabaseAuth()` / `useUser()`. Feature pages use `useCollection`/`useRow` hooks under `src/supabase/hooks/` for live queries.

- **Server-as-user client (`src/supabase/server.ts`)** — `createSupabaseServerClient()` is for Route Handlers, Server Actions, and Server Components. It reads the user's session from cookies so RLS runs **as that user**, not with elevated privileges. Use `verifyAuth()` from `src/lib/verify-auth.ts` to confirm the caller is authenticated before reading/writing.

- **Service-role admin client (`src/lib/supabase-admin.ts`)** — Bypasses RLS. Only import from server-only files: Route Handlers, AI flows under `src/ai/flows/`, or Server Actions with `'use server'`. Reserved for trusted admin operations (setting verification status after AI review). **NEVER import from `src/app/` or `src/components/` client code.** Service role key comes from `SUPABASE_SERVICE_ROLE_KEY`.

### Database and security

- Postgres schema lives in `supabase/migrations/` as thirteen versioned SQL files. Run them in the Supabase SQL Editor (or via `supabase db push` if using the CLI) in numeric order. See `supabase/README.md`.
  - `001_initial_schema.sql` — seven core tables and baseline columns
  - `002_rls_policies.sql` — Row Level Security policies on every table
  - `003_storage_buckets.sql` — `profile-photos` and `post-photos` buckets + policies
  - `004_handle_new_user.sql` — `auth.users` insert trigger that auto-creates a `profiles` row
  - `005_application_extensions.sql` — denormalized extras discovered during feature-page migration: `profiles.location`, `profiles.personality_profile` (legacy embedded JSON), `profiles.top_matches` (cached match list), plus rich `chat_requests` date-invite fields (`match_score`, `reason`, `date_status`, `sender_name/photo_url`, `receiver_name/photo_url`, etc.)
  - `006_conversation_last_message.sql` — adds `conversations.last_message` preview column so the `/messages` sidebar can render a snippet without an extra query
  - `007_lock_profile_privileged_columns.sql` — **security hardening**: revokes column-level UPDATE privilege on `profiles.identity_verified`, `verification_status`, `tier`, and `email` from the `authenticated` and `anon` roles, closing a hole where a user could self-verify via the browser client. After this migration, those columns can only be written via the service-role client from trusted server code (Route Handlers, Server Actions, AI flows).
  - `008_add_stage_tracking.sql`, `010_fix_email_verified_check.sql`, `011_drop_stage_tracking.sql`, `012_enable_realtime.sql` — earlier feature migrations (see git history)
  - `013_post_date_feedback.sql` — `date_feedback` table + `chat_requests.scheduled_at` for the post-date feedback feature
- Seven core tables under `public`: `profiles`, `posts`, `personality_profiles`, `bot_chats`, `chat_requests`, `conversations`, `messages`. Every table has **Row Level Security (RLS) enabled** and explicit allow policies — default is deny.
- Helper functions `is_email_verified()` and `is_conversation_participant(conv_id)` encapsulate common security checks used by multiple policies.
- A `handle_new_user()` trigger on `auth.users` insert auto-creates the matching `profiles` row. This replaces the old `UserProfileInitializer` component and eliminates the race condition where profile rows could be missing.
- TypeScript types live in two places: `src/lib/database.types.ts` — hand-written snake_case types matching the SQL schema, used by Supabase clients; and `src/types/index.ts` — legacy camelCase `UserProfile` type used by most UI components (see `MergedProfile` in `src/hooks/use-auth.ts` for how the two coexist). Regenerate the first with `npx supabase gen types typescript --project-id <ref> --schema public > src/lib/database.types.ts` after any schema change.

### AI (Genkit + Gemini)

- `src/ai/genkit.ts` — single shared `ai` instance, `googleai/gemini-2.5-flash`, key from `GOOGLE_GENAI_API_KEY`.
- `src/ai/flows/*.ts` — each flow file starts with `'use server'` and exports async functions the UI calls **as Next.js Server Actions**, not HTTP endpoints. `src/ai/dev.ts` just imports every flow so the Genkit dev UI can see them. Flows: `ai-personality-interview` (Vera, the 3-phase interview bot), `find-matches-flow`, `ai-date-planner`, `verify-identity-flow`. Flows that read/write DB should use `supabaseAdmin` from `src/lib/supabase-admin.ts`.
- Schemas are defined with `z` from `genkit` (not plain `zod`) — keep using the genkit-re-exported `z` in flow files.

### Storage

Two public-read buckets live in Supabase Storage:

- `profile-photos` — user profile pictures. Write policies restrict uploads to `{auth.uid()}/...` paths.
- `post-photos` — photos attached to user posts. Same per-user folder rule.

**Identity verification photos are never stored.** The `/verification` page sends the ID card + selfie directly to `/api/verify-identity`, which calls Gemini to make a decision. The decision is persisted on `profiles.verification_status` + `profiles.identity_verified`; the images are discarded.

### Realtime

Supabase Realtime replaces Firestore `onSnapshot`. The `useCollection` and `useRow` hooks in `src/supabase/hooks/` accept an optional `realtime` option that opens a `postgres_changes` channel and refetches on any INSERT/UPDATE/DELETE matching the provided filter. Messages, chat requests, matches notifications, and bot chats all use this.

### App Router structure

`src/app/` is organized by feature: `auth/` (login/signup/verify), `bot/` (Vera chat), `matches/`, `messages/`, `profile/`, `requests/`, `verification/`, `admin/` (cleanup / reset-user tools), plus API routes under `api/` for `verify-identity` and `ping`. `src/app/layout.tsx` mounts `SupabaseProvider`, global listeners (`RequestNotificationListener`, `DateReminderListener`), `BackgroundEffects`, and `Toaster` once.

### UI system

shadcn/ui (`components.json`, neutral base, RSC mode, Lucide icons). Primitives live in `src/components/ui/`, feature components directly in `src/components/`. Tailwind is configured in `tailwind.config.ts` with the TrueVibe palette from `docs/blueprint.md` (primary violet `#9066CC`, background `#FAF9FB`, accent `#939AEB`). Body font is `Inter`, loaded via `<link>` in `layout.tsx` and referenced as `font-body`.

Path alias: `@/*` → `src/*`.

### Security model

- **`next.config.ts`** sets a strict set of security headers + a CSP on `/(.*)`. Any new third-party origin (API host, image CDN, script) must be added to the relevant CSP directive (`script-src` / `frame-src` / `img-src` / `connect-src`) **and** to `images.remotePatterns` if it serves images. Current allowlist: Google Fonts, `placehold.co`, `images.unsplash.com`, `picsum.photos`/`fastly.picsum.photos`, `*.supabase.co` (both `https://` and `wss://` for Realtime websocket), `generativelanguage.googleapis.com` (Gemini).
- **RLS policies** replace the old `firestore.rules`. Every table enforces owner-only or participant-only access server-side. Messages are immutable — no UPDATE or DELETE policies, matching the old Firestore rules but made explicit.
- **Storage policies** enforce that uploaded files land in a `{auth.uid()}/...` folder in each bucket; cross-user writes are blocked by Storage RLS.
- **Server Actions body limit** is raised to `20mb` in `next.config.ts` (`experimental.serverActions.bodySizeLimit`) for legacy reasons — can likely be reduced now that verification photos don't flow through Server Actions.

### Environment variables

Server-only (do not expose to the client):

- `GOOGLE_GENAI_API_KEY` — Genkit / Gemini
- `SUPABASE_SERVICE_ROLE_KEY` — bypasses all RLS. Only imported from `src/lib/supabase-admin.ts`. Never put in any `NEXT_PUBLIC_*` variable.
- `RESEND_API_KEY` — reserved for future custom email templates (Supabase Auth currently sends verification emails natively)
- `CRON_SECRET` — shared secret Vercel Cron sends as `Authorization: Bearer <secret>` to the `/api/post-date-nudge` route. Generate once with `openssl rand -hex 32`, set on Vercel + in `.env.local` for local cron tests.

Public (exposed to the browser — safe because RLS gates all queries):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_APP_URL`

### Deployment

- **Vercel only.** Firebase App Hosting has been removed. `.claude/settings.local.json` grants `vercel logs/inspect/env` and `vercel --prod` permissions.
- After cloning, run the SQL migration files under `supabase/migrations/` (`001` through `013`) in the Supabase SQL Editor in numeric order, then populate `.env.local` with the Supabase URL + keys.

## Conventions worth preserving

- Keep `'use server'` / `'use client'` directives explicit at file top — the Supabase browser client is imported only from client files; `supabase-admin` and all AI flows are server-only.
- When adding a new Genkit flow, add an `import '@/ai/flows/<name>.ts'` line to `src/ai/dev.ts` so it shows up in the Genkit dev UI.
- When adding a new shadcn component, use the aliases already declared in `components.json` (`@/components/ui`, `@/lib/utils`, `@/hooks`).
- For queries: prefer the `useCollection`/`useRow` hooks under `src/supabase/hooks/` so realtime + loading state are consistent. For one-off reads/writes in event handlers, call `supabase.from(...)` directly and handle errors with toasts at the call site.
- When adding database columns, always write a new migration file under `supabase/migrations/` (don't edit existing ones) and regenerate `src/lib/database.types.ts`.

## Known follow-up work

- The `src/lib/database.types.ts` file is hand-written, not auto-generated. Regenerate it after the live Supabase project is set up and before any future schema changes. The browser/server/admin clients intentionally do not pass the `<Database>` generic because Supabase v2.103's strict Insert/Update inference doesn't match hand-written types perfectly — this can be re-enabled after `supabase gen types` runs against the real project.
- `MergedProfile` (in `src/hooks/use-auth.ts`) exposes both camelCase (legacy) and snake_case (new) fields on the profile to avoid a sweeping rename across every component. Over time, components should be migrated to snake_case and the legacy adapter (`src/supabase/adapters.ts`) can be retired.
- `DatePlannerModal` / `SenderDatePlannerModal` currently stuff their date-planning fields into `chat_requests.message` as JSON. A future migration should add dedicated columns (or a `date_plans` table) for these.
- `src/components/ui/calendar.tsx` has pre-existing TypeScript errors from an outdated `react-day-picker` CustomComponents API — unrelated to the Supabase migration, flagged here so they don't get mistaken for migration issues.
- The external Google Fonts `<link>` in `src/app/layout.tsx` could be migrated to `next/font` for zero-CLS loading. Out of scope for this migration.
