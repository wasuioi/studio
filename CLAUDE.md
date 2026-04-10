# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

All project files live at the git repository root. The Next.js app, Firebase config, and tooling are all at the top level — run every command below from the repo root.

**History note:** This repo is a clone of `wasuioi/studio`, which nests the app under an inner `studio/` subdirectory. On 2026-04-10 the inner `studio/` was flattened into the repo root to simplify the layout. The current branch (`complete_secrurity`) therefore diverges from upstream in a single "flatten" commit that renames every tracked file from `studio/<path>` to `<path>`. When pulling from upstream, expect heavy rename conflicts.

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

**Important:** `next.config.ts` sets `typescript.ignoreBuildErrors: true` and `eslint.ignoreDuringBuilds: true`. `npm run build` will succeed even when the code is broken — always run `npm run typecheck` and `npm run lint` explicitly to catch real errors. Do not remove those flags without fixing the backlog of existing errors first.

There is no test runner wired up in `package.json`.

## High-level architecture

TrueVibe is a Next.js 15 (App Router) + React 19 + TypeScript dating app. The core stack is **Firebase (Auth / Firestore / Storage) on the client, Firebase Admin + Genkit (Google Gemini) on the server, Stripe for payments, Resend for email, and Upstash Redis for rate limiting.** It deploys both to Firebase App Hosting (`apphosting.yaml`) and Vercel.

### Client ⇄ server boundary

Two separate Firebase surfaces — do not mix them:

- **Client (`src/firebase/`)** — `'use client'` modules built on the `firebase` web SDK. `initializeFirebase()` in `src/firebase/index.ts` boots the app using the **hardcoded** `firebaseConfig` in `src/firebase/config.ts` (public web API keys — that is fine for Firebase web configs). `FirebaseClientProvider` wraps the entire app in `src/app/layout.tsx` and exposes `useUser()`, `useFirestore()`, `useAuth()`, and the `useCollection` / `useDoc` helpers under `src/firebase/firestore/`. `src/firebase` also re-exports an error-emitter + `FirebaseErrorListener` for surfacing Firestore permission errors as toasts.
- **Server (`src/lib/firebaseAdmin.ts`)** — `firebase-admin` bootstrapped from `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`, `FIREBASE_ADMIN_PRIVATE_KEY` (with `\n` escapes) or falls back to ADC. Use `verifyIdToken(request)` from API routes to authenticate callers via the `Authorization: Bearer <idToken>` header. Only `src/app/api/**`, `src/ai/flows/**`, and other server-only files may import this.

### AI (Genkit + Gemini)

- `src/ai/genkit.ts` — single shared `ai` instance, `googleai/gemini-2.5-flash`, key from `GOOGLE_GENAI_API_KEY`.
- `src/ai/flows/*.ts` — each flow file starts with `'use server'` and exports async functions the UI calls **as Next.js Server Actions**, not HTTP endpoints. `src/ai/dev.ts` just imports every flow so the Genkit dev UI can see them. Flows currently include: `ai-personality-interview` (Vera, the 3-phase interview bot), `find-matches-flow`, `ai-date-planner`, `verify-identity-flow`.
- Schemas are defined with `z` from `genkit` (not plain `zod`) — keep using the genkit-re-exported `z` in flow files.

### App Router structure

`src/app/` is organized by feature: `auth/` (login/signup/verify), `bot/` (Vera chat), `matches/`, `messages/`, `profile/`, `requests/`, `verification/`, `admin/` (cleanup / reset-user tools), plus API routes under `api/` for `auth/send-verification`, `stripe/create-payment-intent`, `stripe/refund`, `verify-identity`, and `ping`. `src/app/layout.tsx` mounts global listeners once: `RequestNotificationListener`, `DateReminderListener`, `UserProfileInitializer`, `BackgroundEffects`, `Toaster`.

### UI system

shadcn/ui (`components.json`, neutral base, RSC mode, Lucide icons). Primitives live in `src/components/ui/`, feature components directly in `src/components/`. Tailwind is configured in `tailwind.config.ts` with the TrueVibe palette from `docs/blueprint.md` (primary violet `#9066CC`, background `#FAF9FB`, accent `#939AEB`). Body font is `Inter`, loaded via `<link>` in `layout.tsx` and referenced as `font-body`.

Path alias: `@/*` → `src/*`.

### Security model

- **`next.config.ts`** sets a strict set of security headers + a CSP on `/(.*)`. Any new third-party origin (API host, image CDN, script) must be added to the relevant CSP directive (`script-src` / `frame-src` / `img-src` / `connect-src`) **and** to `images.remotePatterns` if it serves images. Current allowlist: Stripe JS/hooks, Google Fonts, `placehold.co`, `images.unsplash.com`, `picsum.photos`/`fastly.picsum.photos`, `firebasestorage.googleapis.com`, Firebase realtime, `*.googleapis.com`, `generativelanguage.googleapis.com`.
- **`firestore.rules`** — messaging (`conversations/**`) and verification requests gate on `request.auth.token.email_verified == true`. Chat list queries require clients to filter by `participantIds` with `array-contains` (the rule inspects `request.query.filters`). Note that `/users/{userId}` currently allows public `read/create/update` — the properly-scoped rules are commented out in the file; keep that context when changing user-profile access.
- **`storage.rules`** — verification document uploads.
- **Server Actions body limit** is raised to `20mb` in `next.config.ts` (`experimental.serverActions.bodySizeLimit`) to accommodate identity-verification uploads.

### Environment variables

Server-only (do not expose to the client):

- `GOOGLE_GENAI_API_KEY` — Genkit / Gemini
- `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`, `FIREBASE_ADMIN_PRIVATE_KEY` — Admin SDK
- Stripe secret key (used under `src/app/api/stripe/**`)
- Upstash Redis URL/token (used with `@upstash/ratelimit` + `@upstash/redis`)
- Resend API key (used for verification emails)

Client Firebase config is hardcoded in `src/firebase/config.ts` on purpose — see the comment in `initializeFirebase()`.

### Deployment

- **Firebase App Hosting** via `apphosting.yaml` (`maxInstances: 1`) + `firebase.json` wiring `firestore.rules` and `storage.rules`.
- **Vercel** is also used; `.claude/settings.local.json` grants `vercel logs/inspect/env` and `vercel --prod` permissions, so treat Vercel as a live deployment target too.
  - ⚠️ After the 2026-04-10 flatten, if the Vercel project's **Root Directory** setting is `studio`, change it to `.` (repo root) in the Vercel dashboard (Project Settings → General → Root Directory). The old nested folder no longer exists, so deployments will fail until this is fixed.

## Conventions worth preserving

- Keep `'use server'` / `'use client'` directives explicit at file top — the Firebase client SDK is imported only from client files; `firebase-admin` and all AI flows are server-only.
- When adding a new Genkit flow, add an `import '@/ai/flows/<name>.ts'` line to `src/ai/dev.ts` so it shows up in the Genkit dev UI.
- When adding a new shadcn component, use the aliases already declared in `components.json` (`@/components/ui`, `@/lib/utils`, `@/hooks`).
- `src/firebase/non-blocking-login.tsx` and `non-blocking-updates.tsx` implement the app's "fire-and-forget + surface errors via `errors.ts`/`FirebaseErrorListener`" pattern — prefer it to `await`-ing writes in UI handlers.
