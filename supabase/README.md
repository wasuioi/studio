# Supabase migrations for TrueVibe

This directory holds the SQL migrations that define the TrueVibe database schema, RLS, storage buckets, and the auth-signup trigger.

## How to run these migrations

You have two options:

### Option A — paste into the Supabase SQL Editor (simplest)

1. Open the Supabase dashboard → your project → **SQL Editor**
2. Run the files in order, one at a time:
   1. `001_initial_schema.sql`
   2. `002_rls_policies.sql`
   3. `003_storage_buckets.sql`
   4. `004_handle_new_user.sql`
3. After each one, check for errors in the output pane.

### Option B — Supabase CLI (if installed)

```bash
# From the studio/ directory
supabase link --project-ref <your-project-ref>
supabase db push
```

## Verifying the migrations worked

After running all four, in the Supabase dashboard:

- **Table Editor** → you should see `profiles`, `posts`, `personality_profiles`, `bot_chats`, `chat_requests`, `conversations`, `messages`.
- **Authentication → Policies** → each table should show at least one policy (deny-by-default otherwise).
- **Storage** → you should see `profile-photos` and `post-photos` buckets.
- **Database → Functions** → you should see `handle_new_user`, `is_email_verified`, `is_conversation_participant`, `set_updated_at`.
- **Database → Triggers** → you should see `on_auth_user_created` on `auth.users`.

## After running migrations — regenerate types

Once the schema is applied, regenerate the TypeScript types file so the app code is type-safe against the live schema:

```bash
npx supabase gen types typescript --project-id <your-project-ref> --schema public > src/lib/database.types.ts
```

The repo ships with a hand-written `src/lib/database.types.ts` that matches these migrations exactly, so the app compiles without this step — but regenerating is recommended after any future schema changes.
