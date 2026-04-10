# Firebase → Supabase Migration — Design Spec

**Date:** 2026-04-10
**Status:** Approved (brainstorm), pending implementation plan
**Author:** Claude Code (brainstorming session with user)
**Target branch:** `migrate/supabase` (to be created)

---

## 1. Goal and Context

Replace the Firebase data layer (Auth, Firestore, Storage) with Supabase (Auth, Postgres, Storage) while keeping every existing feature of TrueVibe: email/password login, email verification, real-time messages, real-time chat requests, profile posts, Vera bot chat, identity verification, and matching. UI (shadcn/ui + Tailwind) and AI flows (Genkit + Google Gemini) remain unchanged.

### Why

The user wants **SQL/Postgres** for complex queries (matching, aggregate stats, JOINs) that are painful to express in Firestore. Secondary benefits: single deployment target (Vercel), cleaner schema with foreign keys, and Row Level Security enforced inside the database.

### Constraints and decisions

| # | Decision | Rationale |
|---|---|---|
| 1 | **No production data to migrate.** | App is still in dev; Firebase data is disposable. |
| 2 | **Keep all real-time features** (messages, chat requests, matches, bot, notifications). | Dating app UX requires live updates. |
| 3 | **v0 auth = email + password only**, using Supabase Auth's built-in email verification. | Matches current feature set. OAuth (Google, Apple), magic links can be added later. |
| 4 | **Verification ID photos are never stored.** | Photo lives in browser memory → sent to AI flow → only the verification status is persisted in `profiles.verification_status`. Saves storage cost and improves privacy. |
| 5 | **Supabase Storage is used for persistent user content** — profile photos and post photos. | User's explicit choice. |
| 6 | **Vercel-only deployment.** Firebase App Hosting is dropped entirely. | Simpler, single target, cleaner. |
| 7 | **Architectural approach: pure `@supabase/supabase-js`** (no ORM in v0). | Fewest new concepts for a dev new to coding; direct 1:1 translation of current Firebase patterns. Drizzle can be added later if query complexity grows. |
| 8 | **Migration style: big-bang rewrite on a branch.** | Main branch runs Firebase untouched. Merge and cut over once the new branch is verified. Zero half-broken states. |

### Non-goals

- Adding OAuth providers (Google/Apple) — deferred to a later phase.
- Adding magic-link auth — deferred.
- Custom-branded verification emails via Resend — deferred. Supabase's built-in email sending is used in v0.
- Message edit/delete — not currently supported, not added.
- Automated test suite — none exists today, not introduced by this migration. Verification is manual per phase.

---

## 2. Overview and Tech Stack Changes

### Package changes

**Remove:**
- `firebase`
- `firebase-admin`

**Add:**
- `@supabase/supabase-js` — core Supabase client
- `@supabase/ssr` — Next.js App Router helpers (cookie-based sessions across client + server)

**Unchanged:**
- `stripe`, `@upstash/redis`, `@upstash/ratelimit`, `resend`, `genkit`, `@genkit-ai/google-genai`, `next`, `react`, shadcn/ui dependencies

### Files removed

- `apphosting.yaml`
- `firebase.json`
- `firestore.rules`
- `storage.rules`
- `src/firebase/` (entire directory)
- `src/lib/firebaseAdmin.ts`
- `src/app/api/auth/send-verification/route.ts` — Supabase Auth handles verification email directly
- `src/components/UserProfileInitializer.tsx` — replaced by the `handle_new_user` database trigger

### Files created

- `supabase/migrations/*.sql` — version-controlled SQL migrations
- `src/supabase/client.ts` — browser client
- `src/supabase/server.ts` — server client for Route Handlers / Server Components / Server Actions
- `src/supabase/admin.ts` — service-role client for trusted server-only operations
- `src/supabase/provider.tsx` — React context + session state
- `src/supabase/types.ts` — re-exports generated DB types
- `src/supabase/hooks/use-user.ts` — replaces Firebase `useUser`
- `src/supabase/hooks/use-row.ts` — replaces Firebase `useDoc`
- `src/supabase/hooks/use-collection.ts` — replaces Firebase `useCollection` (includes real-time subscription)
- `src/lib/database.types.ts` — auto-generated from Supabase schema (`supabase gen types typescript`)
- `src/lib/supabase-admin.ts` — replaces `firebaseAdmin.ts`
- `src/lib/verify-auth.ts` — replaces the `verifyIdToken` helper

### Environment variables

**Remove from Vercel + `.env.local`:**
- `FIREBASE_ADMIN_PROJECT_ID`
- `FIREBASE_ADMIN_CLIENT_EMAIL`
- `FIREBASE_ADMIN_PRIVATE_KEY`
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`

**Add:**
- `NEXT_PUBLIC_SUPABASE_URL` — public, used by browser and server
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — public, safe because RLS gates everything
- `SUPABASE_SERVICE_ROLE_KEY` — **server-only**, bypasses RLS, never exposed to the client

**Unchanged:** `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `GOOGLE_GENAI_API_KEY`, `NEXT_PUBLIC_APP_URL`, `RESEND_API_KEY` (if kept for future custom email templates).

### High-level architecture

```
┌─ Browser ──────────────────────────────────┐
│  React components                          │
│  ├─ useUser()                               │
│  ├─ useRow()             → src/supabase/   │
│  └─ useCollection()        client.ts       │
│     (real-time subscription)                │
└─────────────────│──────────────────────────┘
                  │ HTTPS + cookies
┌─ Supabase ──────▼──────────────────────────┐
│  Auth     (email + password + verification)│
│  Postgres (users, posts, messages, ...)     │
│  Realtime (message + request subscriptions) │
│  Storage  (profile-photos, post-photos)     │
│  RLS policies guard every table             │
└────────────────▲───────────────────────────┘
                 │
┌─ Vercel Functions (Route Handlers) ────────┐
│  /api/stripe/*        ─┐                    │
│  /api/verify-identity ─┤→ supabase/server.ts│
│  /api/ping             │  or admin.ts       │
└────────────────────────┘                    │
```

---

## 3. Database Schema

All tables live in the `public` schema. Every table has Row Level Security enabled. IDs are `uuid`, timestamps are `timestamptz`.

### `profiles`

Replaces Firestore `users/{userId}`. One row per authenticated user. `id` is the same UUID as the Supabase Auth user.

| column | type | notes |
|---|---|---|
| `id` | `uuid PRIMARY KEY` | FK → `auth.users(id) ON DELETE CASCADE` |
| `email` | `text NOT NULL` | mirrored from auth for convenience |
| `display_name` | `text` | |
| `bio` | `text` | |
| `photo_url` | `text` | public URL from Supabase Storage |
| `identity_verified` | `boolean` default `false` | |
| `verification_status` | `text` default `'not_verified'` | enum: `not_verified`, `pending`, `verified`, `rejected` |
| `profile_completed` | `boolean` default `false` | |
| `tier` | `text` default `'free'` | `'free'` or `'premium'` |
| `last_login` | `timestamptz` | |
| `created_at` | `timestamptz` default `now()` | |
| `updated_at` | `timestamptz` default `now()` | auto-updated by trigger |

Dropped from the current Firestore user doc:
- `uid` (duplicate of `id`)
- `name` (duplicate of `displayName`)
- `profilePhotoUrl` (duplicate of `photoURL`)
- `emailVerified` — now lives in `auth.users.email_confirmed_at`

During implementation, the profile page and matches page will be scanned for additional fields (age, gender, location, interests, etc.) and those will be added here.

### `posts`

Replaces `users/{uid}/posts/{postId}`.

| column | type | notes |
|---|---|---|
| `id` | `uuid PK` | `default gen_random_uuid()` |
| `user_id` | `uuid NOT NULL` | FK → `profiles(id) ON DELETE CASCADE` |
| `content` | `text` | |
| `photo_url` | `text` | nullable — Supabase Storage URL |
| `created_at` | `timestamptz` default `now()` | |

Index: `(user_id, created_at DESC)` for profile page listing.

### `personality_profiles`

Replaces `users/{uid}/personality/*`. Stores the finalized Vera interview output.

| column | type |
|---|---|
| `user_id` | `uuid PRIMARY KEY` (also FK → `profiles(id) ON DELETE CASCADE`) |
| `partner_vision` | `text` |
| `traits` | `jsonb` |
| `summary` | `text` |
| `completed_at` | `timestamptz` |

### `bot_chats`

Replaces `bot_chats/{chatId}`. Stores the 3-phase Vera interview conversation.

| column | type |
|---|---|
| `id` | `uuid PK default gen_random_uuid()` |
| `user_id` | `uuid NOT NULL` FK → `profiles(id) ON DELETE CASCADE` |
| `phase` | `int default 1` |
| `messages` | `jsonb` (array of `{role, content, timestamp}`) |
| `completed` | `boolean default false` |
| `created_at` | `timestamptz default now()` |
| `updated_at` | `timestamptz default now()` |

Index: `(user_id, updated_at DESC)`.

### `chat_requests`

Replaces `chat_requests/{requestId}`.

| column | type |
|---|---|
| `id` | `uuid PK` |
| `sender_id` | `uuid NOT NULL` FK → `profiles(id)` |
| `receiver_id` | `uuid NOT NULL` FK → `profiles(id)` |
| `status` | `text default 'pending'` — `pending`, `accepted`, `rejected` |
| `message` | `text` | optional opener |
| `created_at` | `timestamptz default now()` |
| `updated_at` | `timestamptz default now()` |

Unique constraint: `(sender_id, receiver_id)` — prevents duplicate/spam requests.

### `conversations`

Replaces `conversations/{conversationId}`.

| column | type |
|---|---|
| `id` | `uuid PK` |
| `participant_ids` | `uuid[] NOT NULL` — exactly 2 UUIDs, sorted ascending to prevent duplicate conversations |
| `last_message_at` | `timestamptz` |
| `created_at` | `timestamptz default now()` |

Index: GIN on `participant_ids` for fast "contains user" queries.

### `messages`

Replaces `conversations/{cid}/messages/*`.

| column | type |
|---|---|
| `id` | `uuid PK` |
| `conversation_id` | `uuid NOT NULL` FK → `conversations(id) ON DELETE CASCADE` |
| `sender_id` | `uuid NOT NULL` FK → `profiles(id)` |
| `content` | `text NOT NULL` |
| `read_at` | `timestamptz` (nullable) |
| `created_at` | `timestamptz default now()` |

Index: `(conversation_id, created_at DESC)`.

### Dropped from the old schema

- `users/{uid}/verification_requests/*` — no longer needed. ID photos never touch storage; `profiles.verification_status` holds the outcome.

### Auto-created by Supabase

- `auth.users` — managed by Supabase Auth (email, password hash, confirmation state, session tokens).

### Trigger: `handle_new_user()`

A Postgres function + trigger automatically inserts a `profiles` row whenever `auth.users` gains a row.

```sql
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
```

This eliminates the race-condition bug currently documented in `src/components/UserProfileInitializer.tsx:7-9` — the profile row is created atomically with the auth user, on the server, every time.

---

## 4. Security Model (Row Level Security)

Direct replacement for `firestore.rules`. Security lives in Postgres as RLS policies — enforced regardless of client bugs.

### Helper functions

```sql
-- True if the current user's email is verified
create or replace function public.is_email_verified()
returns boolean language sql stable as $$
  select (auth.jwt()->>'email_confirmed_at') is not null;
$$;

-- True if the current user is a participant in a conversation
create or replace function public.is_conversation_participant(conv_id uuid)
returns boolean language sql stable as $$
  select exists (
    select 1 from public.conversations
    where id = conv_id and auth.uid() = any(participant_ids)
  );
$$;
```

### Policy matrix

Every table below has `ENABLE ROW LEVEL SECURITY` set. Default is deny.

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `profiles` | any authenticated user | blocked (trigger only) | owner (`id = auth.uid()`) | blocked (cascades from `auth.users`) |
| `posts` | any authenticated user | owner + email verified | owner | owner |
| `personality_profiles` | owner | owner | owner | owner |
| `bot_chats` | owner | owner | owner | owner |
| `chat_requests` | sender or receiver | email verified + `sender_id = auth.uid()` | sender or receiver | sender or receiver |
| `conversations` | participant + email verified | email verified + self in `participant_ids` | participant + email verified | participant + email verified |
| `messages` | email verified + participant of parent conversation | email verified + `sender_id = auth.uid()` + participant | blocked (immutable) | blocked (immutable) |

### Key changes from the current `firestore.rules`

1. **`profiles` SELECT requires authentication.** Current rules have `allow read: if true` (fully public) with the secure version commented out. RLS version requires `auth.uid() is not null`. If public profiles are ever needed (share links, SEO), a `public_profile_view` materialized view can be added.
2. **`profiles` INSERT is blocked for clients.** Only the `handle_new_user` trigger (running as `SECURITY DEFINER`) can insert — prevents forging a profile for another user.
3. **`messages` are immutable.** No UPDATE or DELETE policies. Matches current Firestore behavior but made explicit.
4. **`chat_requests.sender_id` enforced by the DB.** RLS `WITH CHECK (sender_id = auth.uid())` on insert — identical guarantee to the old Firestore check.

### Storage buckets

| Bucket | Purpose | Read | Write |
|---|---|---|---|
| `profile-photos` | User profile pictures | public | authenticated, only to `{auth.uid()}/...` path |
| `post-photos` | Photos attached to posts | public | authenticated, only to `{auth.uid()}/...` path |

The "only your own folder" rule uses Storage RLS of the form:

```sql
create policy "Users can upload to their own folder"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'profile-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);
```

**No bucket is created for verification documents** — those never touch storage.

### Why this is safer than the current rules

- **Server-enforced.** Postgres is the ultimate gatekeeper; RLS runs below the application layer.
- **Deny-by-default.** Every policy is an explicit allow. The old `allow read: if true` mistake is structurally impossible.
- **Testable.** Policies can be exercised from the SQL console via `set role authenticated; set request.jwt.claim.sub = '...';`.

---

## 5. File Structure

```
studio/
├── supabase/                          🆕
│   ├── migrations/
│   │   ├── 001_initial_schema.sql
│   │   ├── 002_rls_policies.sql
│   │   ├── 003_storage_buckets.sql
│   │   └── 004_handle_new_user.sql
│   └── config.toml                    (optional, for local dev)
│
├── src/
│   ├── supabase/                      🆕 replaces src/firebase/
│   │   ├── client.ts
│   │   ├── server.ts
│   │   ├── admin.ts
│   │   ├── provider.tsx
│   │   ├── types.ts
│   │   └── hooks/
│   │       ├── use-user.ts
│   │       ├── use-row.ts
│   │       └── use-collection.ts
│   │
│   ├── lib/
│   │   ├── database.types.ts          🆕 auto-generated
│   │   ├── supabase-admin.ts          🆕 replaces firebaseAdmin.ts
│   │   └── verify-auth.ts             🆕 replaces verifyIdToken
│   │
│   ├── firebase/                      ❌ DELETE
│   ├── lib/firebaseAdmin.ts           ❌ DELETE
│   ├── components/UserProfileInitializer.tsx  ❌ DELETE (replaced by trigger)
│   │
│   ├── app/                           ✏️  edit every page touching Firestore
│   ├── components/                    ✏️  edit every component touching Firestore
│   ├── hooks/use-auth.ts              ✏️  rewrite for Supabase session
│   └── ai/flows/                      ✏️  swap admin reads/writes
│
├── firestore.rules                    ❌ DELETE
├── storage.rules                      ❌ DELETE
├── firebase.json                      ❌ DELETE
├── apphosting.yaml                    ❌ DELETE
├── .env.local                         ✏️  new Supabase vars
└── package.json                       ✏️  swap firebase → supabase deps
```

---

## 6. Execution Plan (9 Phases)

Each phase is independently testable. User reviews at the end of each phase before moving on. All work happens on branch `migrate/supabase`; `main` continues running Firebase untouched.

| # | Phase | Scope | Verification |
|---|---|---|---|
| 1 | **Supabase project setup** | Create project on supabase.com, run the 4 migration SQLs, generate TypeScript types (`supabase gen types typescript`), populate `.env.local`. | Tables visible in Supabase dashboard; RLS enabled on each; types file committed. |
| 2 | **Swap packages, delete Firebase** | Uninstall `firebase`, `firebase-admin`. Install `@supabase/supabase-js`, `@supabase/ssr`. Delete `src/firebase/`, `src/lib/firebaseAdmin.ts`, rules files, `apphosting.yaml`, `firebase.json`. | App intentionally fails to compile — TypeScript surfaces every call site that needs rewriting. |
| 3 | **Build the Supabase client layer** | Write `src/supabase/client.ts`, `server.ts`, `admin.ts`, `provider.tsx`, and the three hooks. Wire `SupabaseProvider` into `src/app/layout.tsx`. | `npm run typecheck` passes for the new layer in isolation. |
| 4 | **Rewrite auth** | Rewrite `src/app/auth/signup/page.tsx`, `login/page.tsx`, `verify/page.tsx`. Rewrite `src/hooks/use-auth.ts`. Delete `src/app/api/auth/send-verification/route.ts`. | Manual: sign up → receive Supabase verification email → verify → log in → log out. |
| 5 | **Rewrite profile + posts** | Update `src/app/profile/page.tsx`. Delete `UserProfileInitializer.tsx`. Move profile photo + post photo uploads to Supabase Storage. | Manual: edit profile, upload profile photo, create a post with a photo, delete a post. |
| 6 | **Rewrite matches + chat requests** | Update `src/app/matches/page.tsx`, `requests/page.tsx`, `RequestNotificationListener.tsx`. Enable Supabase Realtime on `chat_requests`. | Manual: send request → receive it in real-time on the other user's browser → accept/reject. |
| 7 | **Rewrite conversations + messages** | Update `src/app/messages/page.tsx`. Enable Supabase Realtime on `messages`. | Manual: open conversation, send a message, see it appear live in a second browser. |
| 8 | **Rewrite Vera bot + verification** | Update `src/app/bot/page.tsx`, `bot/history/page.tsx`, `src/ai/flows/ai-personality-interview.ts`, `verify-identity-flow.ts`. Identity verification uses the client-side-only pattern (photo never persisted). | Manual: complete the 3-phase Vera interview; run identity check with a sample photo. |
| 9 | **Final cleanup + deploy** | Update `CLAUDE.md` to describe the Supabase stack. Run `npm run lint` and `npm run typecheck`. Remove Firebase env vars from Vercel, add Supabase env vars. Create a preview deploy. | Lint + typecheck clean. Full smoke test on Vercel preview URL. |

### Rollback

- **Mid-migration:** `git checkout main` — Firebase version untouched.
- **Post-merge in prod:** Vercel **Instant Rollback** to the last Firebase deployment (~30 seconds).

### Testing strategy

No automated test runner exists in `package.json`, and none is introduced. Verification is **manual per phase** using explicit checklists provided at each step, followed by a full end-to-end smoke test before merge.

---

## 7. Open Questions for Implementation

These will be resolved during the planning phase or early implementation, not during brainstorm:

1. **Exact profile fields beyond the core set** — need to scan `src/app/profile/page.tsx` and `src/app/matches/page.tsx` for any additional columns (age, gender, location, interests).
2. **Placeholder images source** — confirm `src/lib/placeholder-images.*` continues to work unchanged.
3. **CSP updates in `next.config.ts`** — the `connect-src` directive currently lists Firebase hosts; it must be updated to include `*.supabase.co`.
4. **Stripe refund route interaction with Firebase** — `src/app/api/stripe/refund/route.ts` may read user data to validate refund eligibility; verify this is rewritten in phase 8 or 9.
5. **Genkit flows that read Firestore directly** — confirm which of the 4 flows touch the DB vs only LLM.

---

## 8. Success Criteria

The migration is complete when all of the following are true:

1. Not a single import of `firebase` or `firebase-admin` remains in `src/`.
2. `firestore.rules`, `storage.rules`, `firebase.json`, `apphosting.yaml`, `src/firebase/`, `src/lib/firebaseAdmin.ts`, and `src/components/UserProfileInitializer.tsx` are deleted.
3. `npm run typecheck` and `npm run lint` both pass with zero errors.
4. All 9 phases' manual smoke tests pass.
5. A Vercel preview deploy boots, allows signup, email verification, login, profile editing, posts, matches, chat requests, messaging (with real-time), Vera interview, and identity verification.
6. `CLAUDE.md` is updated to describe the Supabase architecture.
7. Vercel environment variables no longer contain any `FIREBASE_*` keys.

---

## Change Log

- **2026-04-10** — Initial design approved during brainstorming session with user.
