# Staged Interview & Progressive Feature Gating — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Vera's personality interview into a 3-stage journey (invisible to members) that progressively unlocks app features, and ship a cleanly-deletable dev harness for testing without Gemini calls.

**Architecture:** Extend Vera's output schema with `stageReached`, `suggestedBio`, and `requestPhotoUpload`. Track progression in a new `profiles.stage` column written only by server code. Gate features via a pure helper `canUse(feature, stage)`. Dev-only code lives in `src/lib/dev-tools/` and `src/components/dev/` so it can be removed as a unit before production rollout.

**Tech Stack:** Next.js 15 App Router · React 19 · Supabase (Postgres + Auth + Storage) · Genkit + Gemini 2.5 Flash · shadcn/ui · Tailwind.

**Design spec:** [`docs/superpowers/specs/2026-04-16-staged-interview-gating-design.md`](../specs/2026-04-16-staged-interview-gating-design.md)

**Verification note:** This repo has **no test runner** wired up (per CLAUDE.md). Each task's verification uses `npm run typecheck`, `npm run lint`, and explicit manual steps in the dev server. Every task ends with a commit.

---

## Task 1: Database migration 008

**Files:**
- Create: `supabase/migrations/008_add_stage_tracking.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- Migration 008: add stage tracking + bio to profiles, lock stage from user writes
--
-- Adds two columns:
--   profiles.stage  -- 0..3, incremented by server only
--   profiles.bio    -- optional self-description suggested by Vera, editable by user
--
-- Mirrors the security pattern in migration 007: stage is revoked from the
-- authenticated / anon roles at column level so only service-role writes (via
-- supabaseAdmin) can advance it.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS stage INTEGER NOT NULL DEFAULT 0
    CHECK (stage BETWEEN 0 AND 3);

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS bio TEXT;

-- Block browser/anon clients from writing stage directly.
REVOKE UPDATE (stage) ON profiles FROM authenticated, anon;
-- bio stays user-writable so the BioApprovalModal can save directly.
```

- [ ] **Step 2: Apply the migration**

Open Supabase SQL Editor, paste the file contents, click Run. Expected: "Success. No rows returned."

Verify the REVOKE worked:

```sql
SELECT grantee, privilege_type
FROM information_schema.column_privileges
WHERE table_name = 'profiles' AND column_name = 'stage';
```

Expected: no rows for `authenticated` or `anon` with privilege `UPDATE`. Service role (if listed) may appear — that's fine.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/008_add_stage_tracking.sql
git commit -m "feat(db): migration 008 — add profiles.stage and profiles.bio"
```

---

## Task 2: Update TypeScript database types

**Files:**
- Modify: `src/lib/database.types.ts`

- [ ] **Step 1: Locate the profiles type**

Open `src/lib/database.types.ts` and find the `profiles` entry inside the `Tables` interface. There will be three nested shapes — `Row`, `Insert`, `Update`.

- [ ] **Step 2: Add stage and bio to all three shapes**

In the `Row` shape, add:
```ts
          stage: number
          bio: string | null
```

In the `Insert` shape, add:
```ts
          stage?: number
          bio?: string | null
```

In the `Update` shape, add:
```ts
          stage?: number
          bio?: string | null
```

Keep existing fields untouched. Insert these lines alphabetically near the other top-level profile fields (close to `photo_url` / `display_name`).

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: PASS with no errors about `stage` or `bio`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/database.types.ts
git commit -m "feat(types): add stage and bio columns to profiles types"
```

---

## Task 3: Feature-gates helper

**Files:**
- Create: `src/lib/feature-gates.ts`

- [ ] **Step 1: Write the helper**

```ts
// src/lib/feature-gates.ts
//
// Pure function that decides whether a given stage unlocks a given feature.
// Stages are internal — UI code should use canUse() to render/hide features
// and must never surface the number itself to members.

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

export function canUse(feature: Feature, stage: number | null | undefined): boolean {
  if (stage === null || stage === undefined) return false;
  return stage >= REQUIRED_STAGE[feature];
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Manual sanity check**

Open `src/lib/feature-gates.ts` in a Node REPL or add a one-line log in any page temporarily:

```ts
import { canUse } from '@/lib/feature-gates';
console.log(canUse('send_date_invite', 1)); // false
console.log(canUse('send_date_invite', 2)); // true
console.log(canUse('veras_instinct', null)); // false
```

Revert the log before committing.

- [ ] **Step 4: Commit**

```bash
git add src/lib/feature-gates.ts
git commit -m "feat: feature-gates helper mapping stage to unlockable features"
```

---

## Task 4: Dev-tools flag helper

**Files:**
- Create: `src/lib/dev-tools/flag.ts`

- [ ] **Step 1: Write the flag**

```ts
// src/lib/dev-tools/flag.ts
//
// DEV-ONLY. This whole folder (src/lib/dev-tools/) is scheduled for deletion
// before production rollout. See README.md in this folder.
//
// Two env vars gate dev tools:
//   NEXT_PUBLIC_ENABLE_DEV_TOOLS  — readable from browser; controls UI visibility
//   ENABLE_DEV_TOOLS              — server-only; gates Server Actions that mutate state
//
// isDevToolsEnabled() is safe to call from both client and server modules.
// In production neither variable is set, so it returns false everywhere.

export function isDevToolsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_DEV_TOOLS === 'true';
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/dev-tools/flag.ts
git commit -m "feat(dev-tools): add isDevToolsEnabled env-flag helper"
```

---

## Task 5: Dev-tools response cache

**Files:**
- Create: `src/lib/dev-tools/response-cache.ts`

- [ ] **Step 1: Write the cache wrapper**

```ts
// src/lib/dev-tools/response-cache.ts
//
// DEV-ONLY. localStorage wrapper with a fixed key prefix so we can clear all
// cached AI outputs at once from the dev panel.
//
// Keys used by the app (one place — don't scatter string literals):
//   dev-cached-bio
//   dev-cached-personality
//   dev-cached-matches

const PREFIX = 'dev-cached-';

export type CacheKey = 'bio' | 'personality' | 'matches';

function fullKey(key: CacheKey): string {
  return `${PREFIX}${key}`;
}

export function getCached<T>(key: CacheKey): T | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(fullKey(key));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function setCached<T>(key: CacheKey, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(fullKey(key), JSON.stringify(value));
  } catch {
    // quota exceeded or private mode — silent fail is fine in dev
  }
}

export function clearAllCached(): void {
  if (typeof window === 'undefined') return;
  const keys: CacheKey[] = ['bio', 'personality', 'matches'];
  for (const k of keys) {
    window.localStorage.removeItem(fullKey(k));
  }
}

export function listCached(): Record<CacheKey, boolean> {
  if (typeof window === 'undefined') {
    return { bio: false, personality: false, matches: false };
  }
  return {
    bio: window.localStorage.getItem(fullKey('bio')) !== null,
    personality: window.localStorage.getItem(fullKey('personality')) !== null,
    matches: window.localStorage.getItem(fullKey('matches')) !== null,
  };
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/dev-tools/response-cache.ts
git commit -m "feat(dev-tools): localStorage wrapper for cached AI outputs"
```

---

## Task 6: Dev-tools fixtures

**Files:**
- Create: `src/lib/dev-tools/fixtures/tester-profile.ts`
- Create: `src/lib/dev-tools/fixtures/tester-personality.ts`
- Create: `src/lib/dev-tools/fixtures/tester-bio.ts`
- Create: `src/lib/dev-tools/fixtures/tester-conversation.ts`

- [ ] **Step 1: tester-profile.ts**

```ts
// src/lib/dev-tools/fixtures/tester-profile.ts
// DEV-ONLY. Static profile seed used by devForceStage() when jumping stages.

export const TESTER_PROFILE = {
  display_name: 'Alex Tester',
  age: 28,
  location: 'Bangkok',
  gender: 'Non-binary',
  photo_url: 'https://picsum.photos/seed/alex-tester/400/400',
  profile_completed: true,
} as const;
```

- [ ] **Step 2: tester-personality.ts**

```ts
// src/lib/dev-tools/fixtures/tester-personality.ts
// DEV-ONLY. Shape mirrors the personalityProfile object returned by Vera.
// If the real schema changes, update this fixture too.

export const TESTER_PERSONALITY = {
  user_persona: {
    summary:
      'Warm, thoughtful, and independent. Alex balances a creative career with deep friendships and values honesty above almost everything else.',
    tags: ['Warm', 'Independent', 'Creative', 'Honest'],
  },
  ideal_partner: {
    summary:
      'Someone grounded and curious who welcomes slow mornings and big conversations. Kindness first, wit a close second.',
    tags: ['Kind', 'Curious', 'Grounded', 'Witty'],
  },
  psychological_insights: {
    attachmentStyle: 'Secure-leaning',
    coreNeed: 'Consistent emotional presence, not performative grand gestures.',
    behavioralInsights:
      'Prefers one-on-one depth over group socializing; loyal once trust is established.',
  },
} as const;
```

- [ ] **Step 3: tester-bio.ts**

```ts
// src/lib/dev-tools/fixtures/tester-bio.ts
// DEV-ONLY. Bio Vera would "suggest" for the tester profile.

export const TESTER_BIO =
  "Designer by day, ramen devotee by night. I'm looking for someone who treats small moments like they matter — because they do.";
```

- [ ] **Step 4: tester-conversation.ts**

```ts
// src/lib/dev-tools/fixtures/tester-conversation.ts
// DEV-ONLY. Fake bot_chats.messages payload so the /bot page feels populated
// after a stage skip. Matches the ChatMessage shape used in src/app/bot/page.tsx.

export interface FixtureMessage {
  role: 'user' | 'model';
  message: string;
  timestamp: string;
}

const base = new Date('2026-04-16T09:00:00Z').getTime();
const at = (offsetSec: number) => new Date(base + offsetSec * 1000).toISOString();

export const TESTER_CONVERSATION: FixtureMessage[] = [
  { role: 'model', message: "Hi! I'm Vera. Ready to begin our vibe check?", timestamp: at(0) },
  { role: 'user', message: "Hey Vera — yep, let's do it.", timestamp: at(30) },
  { role: 'model', message: "Awesome. What's your name and how old are you?", timestamp: at(40) },
  { role: 'user', message: "I'm Alex, 28, live in Bangkok.", timestamp: at(80) },
  { role: 'model', message: "Nice to meet you Alex. What kind of relationship are you hoping for?", timestamp: at(95) },
  { role: 'user', message: "Something serious but not rushed. I want a real partner.", timestamp: at(140) },
  { role: 'model', message: "That makes sense. Any absolute deal-breakers for you?", timestamp: at(160) },
  { role: 'user', message: "Dishonesty, and someone who never puts effort into small gestures.", timestamp: at(210) },
  { role: 'model', message: "Got it. Can you share a photo of yourself so I can get your profile ready?", timestamp: at(230) },
  { role: 'user', message: "[uploaded photo]", timestamp: at(260) },
  { role: 'model', message: "Thanks! I've got enough to set up your profile. Let's keep chatting.", timestamp: at(275) },
];
```

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/dev-tools/fixtures/
git commit -m "feat(dev-tools): static fixtures for tester profile + conversation"
```

---

## Task 7: Dev-tools README

**Files:**
- Create: `src/lib/dev-tools/README.md`

- [ ] **Step 1: Write the deletion guide**

```markdown
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
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/dev-tools/README.md
git commit -m "docs(dev-tools): deletion checklist for production rollout"
```

---

## Task 8: Extend Vera AI flow

**Files:**
- Modify: `src/ai/flows/ai-personality-interview.ts`

- [ ] **Step 1: Extend the output schema**

Find `VeraInterviewOutputSchema` (around line 27). Replace it with:

```ts
const VeraInterviewOutputSchema = z.object({
  response: z.string().describe('Vera\'s conversational reply to the user'),
  interviewComplete: z.boolean().describe('True only when ALL required data has been collected and analysis delivered'),
  askPermission: z.boolean().describe('True when ready to share psychological insights, before doing so'),
  stageReached: z.enum(['none', 'stage1', 'stage2', 'stage3']).describe(
    'The highest internal stage fully covered so far. Only promote when the data for that stage has genuinely been collected. If unsure, stay at the previous stage. NEVER mention the word "stage" to the user.'
  ),
  suggestedBio: z.string().optional().describe(
    "A 2-3 sentence bio written in the member's own voice. Only populate on the turn where stageReached transitions to 'stage1' for the first time."
  ),
  requestPhotoUpload: z.boolean().describe(
    'Set true ONLY on turns where you are explicitly asking the member to upload a profile photo. Do not set true if a photo has already been uploaded in this conversation.'
  ),
  personalityProfile: z.object({
    user_persona: z.object({
      summary: z.string().describe('3-4 sentence description of who the user is'),
      tags: z.array(z.string()).describe('Trait tags e.g. Introvert, Ambitious, Secure'),
    }),
    ideal_partner: z.object({
      summary: z.string().describe('3-4 sentence description of what they seek'),
      tags: z.array(z.string()).describe('Trait tags e.g. Kind, Stable, Adventurous'),
    }),
    psychological_insights: z.object({
      attachmentStyle: z.string().optional(),
      coreNeed: z.string().optional().describe('What they actually need vs. what they say they want'),
      behavioralInsights: z.string().optional(),
    }).optional(),
  }).optional().describe('Only populated when interviewComplete is true'),
});
```

- [ ] **Step 2: Add stage rules to the prompt**

In the prompt string (around line 56), find the line `## The 3-Phase Conversational Strategy`. Directly **above** that heading, insert this new section:

```
## Stage Tracking (Internal — NEVER mention "stage" to the user)

Output \`stageReached\` on every turn. The values map to internal coverage milestones. Never utter the word "stage", "level", "unlocked", or "next phase" to the member. The stages simply unlock app features in the background.

- **stage1** — promote ONLY when you have collected: name, age, location, stated relationship goals, at least one deal-breaker, AND the member has uploaded a profile photo (you will see a system line "[System: User just uploaded their profile photo.]" when that happens).
- **stage2** — promote ONLY when, on top of stage1, you have meaningfully covered: communication style, relationship history, and behavioural patterns.
- **stage3** — promote ONLY when, on top of stage2, you have explored deeper preferences and, where it came up naturally, childhood influences.

If the conversation hasn't covered stage1 yet, output \`"none"\`. Never skip a stage.

## Photo request rule

Set \`requestPhotoUpload: true\` on exactly the turn where you ask for a photo. Set \`false\` on all other turns, and also \`false\` once the member has already uploaded one.

## Bio suggestion rule

On the single turn where \`stageReached\` becomes \`"stage1"\` for the first time, also populate \`suggestedBio\` with a warm 2-3 sentence bio written in the member's voice, based on what they've shared. Leave it empty on every other turn.
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: PASS. Output type is inferred so callers will see the new fields as optional/required correctly.

- [ ] **Step 4: Commit**

```bash
git add src/ai/flows/ai-personality-interview.ts
git commit -m "feat(ai): Vera returns stageReached + suggestedBio + requestPhotoUpload"
```

---

## Task 9: Server Actions for stage updates

**Files:**
- Create: `src/app/bot/actions.ts`

- [ ] **Step 1: Write the actions file**

```ts
// src/app/bot/actions.ts
'use server';

import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyAuth } from '@/lib/verify-auth';
import { TESTER_PROFILE } from '@/lib/dev-tools/fixtures/tester-profile';
import { TESTER_PERSONALITY } from '@/lib/dev-tools/fixtures/tester-personality';
import { TESTER_BIO } from '@/lib/dev-tools/fixtures/tester-bio';
import { TESTER_CONVERSATION } from '@/lib/dev-tools/fixtures/tester-conversation';

/**
 * Advance the current user's stage. Rejects attempts to move backwards.
 * Writes via supabaseAdmin because migration 008 revokes UPDATE(stage) from
 * the authenticated role.
 */
export async function updateUserStage(newStage: number): Promise<{ success: boolean }> {
  const session = await verifyAuth();
  const userId = session.user.id;

  if (!Number.isInteger(newStage) || newStage < 1 || newStage > 3) {
    throw new Error(`Invalid stage: ${newStage}`);
  }

  const { data: existing, error: readErr } = await supabaseAdmin
    .from('profiles')
    .select('stage')
    .eq('id', userId)
    .single();

  if (readErr) throw readErr;

  const currentStage = existing?.stage ?? 0;
  if (newStage <= currentStage) {
    // Already at or past this stage — no-op, not an error.
    return { success: true };
  }

  const { error: updateErr } = await supabaseAdmin
    .from('profiles')
    .update({ stage: newStage, updated_at: new Date().toISOString() })
    .eq('id', userId);

  if (updateErr) throw updateErr;

  return { success: true };
}

/**
 * DEV-ONLY. Double-gated by ENABLE_DEV_TOOLS env var. Seeds the current user
 * with fixture data and sets their stage (or resets to 0). Delete this export
 * before production rollout — see src/lib/dev-tools/README.md.
 */
export async function devForceStage(
  targetStage: 0 | 1 | 2 | 3
): Promise<{ success: boolean }> {
  if (process.env.ENABLE_DEV_TOOLS !== 'true') {
    throw new Error('Dev tools are disabled (ENABLE_DEV_TOOLS is not "true")');
  }

  const session = await verifyAuth();
  const userId = session.user.id;

  if (targetStage === 0) {
    // Reset: clear personality_profile + bot_chats, set stage to 0.
    await supabaseAdmin.from('bot_chats').delete().eq('user_id', userId);
    await supabaseAdmin.from('personality_profiles').delete().eq('user_id', userId);
    await supabaseAdmin
      .from('profiles')
      .update({
        stage: 0,
        bio: null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        personality_profile: null as any,
        profile_completed: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);
    return { success: true };
  }

  // Stage 1+ — seed fixtures.
  await supabaseAdmin
    .from('profiles')
    .update({
      display_name: TESTER_PROFILE.display_name,
      age: TESTER_PROFILE.age,
      location: TESTER_PROFILE.location,
      gender: TESTER_PROFILE.gender,
      photo_url: TESTER_PROFILE.photo_url,
      bio: TESTER_BIO,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      personality_profile: TESTER_PERSONALITY as any,
      profile_completed: true,
      stage: targetStage,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  // Upsert the personality_profiles row.
  await supabaseAdmin.from('personality_profiles').upsert({
    user_id: userId,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    traits: TESTER_PERSONALITY as any,
    partner_vision: TESTER_PERSONALITY.ideal_partner.summary,
    summary: TESTER_PERSONALITY.user_persona.summary,
    completed_at: new Date().toISOString(),
  });

  // Seed a bot_chats row only if none exists yet.
  const { data: existingChat } = await supabaseAdmin
    .from('bot_chats')
    .select('id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();

  if (!existingChat) {
    await supabaseAdmin.from('bot_chats').insert({
      user_id: userId,
      phase: 3,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      messages: TESTER_CONVERSATION as any,
      completed: true,
    });
  }

  return { success: true };
}
```

- [ ] **Step 2: Verify `verifyAuth` return shape**

Open `src/lib/verify-auth.ts` and confirm the function returns an object with `user.id`. If the shape differs, adjust the `session.user.id` access above to match — do not guess; match the real return type.

```bash
grep -n "export" src/lib/verify-auth.ts
```

If the function returns `{ data: { user } }` or similar, update the destructuring in `updateUserStage` and `devForceStage`.

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: PASS. Fix any type issues discovered in Step 2 now.

- [ ] **Step 4: Commit**

```bash
git add src/app/bot/actions.ts
git commit -m "feat(bot): Server Actions for stage updates + dev-only stage forcing"
```

---

## Task 10: BioApprovalModal component

**Files:**
- Create: `src/components/BioApprovalModal.tsx`

- [ ] **Step 1: Confirm shadcn Dialog + Textarea are installed**

```bash
ls src/components/ui/dialog.tsx src/components/ui/textarea.tsx
```

Expected: both files exist. If not, install them:

```bash
npx shadcn@latest add dialog textarea
```

- [ ] **Step 2: Write the modal**

```tsx
// src/components/BioApprovalModal.tsx
'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { isDevToolsEnabled } from '@/lib/dev-tools/flag';
import { getCached, setCached } from '@/lib/dev-tools/response-cache';

interface BioApprovalModalProps {
  open: boolean;
  initialBio: string;
  onSave: (bio: string) => Promise<void>;
  onSkip: () => void;
}

export function BioApprovalModal({ open, initialBio, onSave, onSkip }: BioApprovalModalProps) {
  const [bio, setBio] = useState(initialBio);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;

    // Dev cache: reuse first-generated bio across test runs.
    if (isDevToolsEnabled()) {
      const cached = getCached<string>('bio');
      if (cached) {
        setBio(cached);
        return;
      }
      if (initialBio) setCached('bio', initialBio);
    }

    setBio(initialBio);
  }, [open, initialBio]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(bio);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onSkip(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Your bio, drafted with Vera</DialogTitle>
          <DialogDescription>
            Here&apos;s what I put together from our chat. Edit anything that doesn&apos;t feel like you.
          </DialogDescription>
        </DialogHeader>

        <Textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={5}
          className="mt-2"
        />

        <DialogFooter className="mt-4 gap-2 sm:gap-0">
          <Button variant="ghost" onClick={onSkip} disabled={saving}>
            Skip for now
          </Button>
          <Button onClick={handleSave} disabled={saving || bio.trim().length === 0}>
            {saving ? 'Saving…' : 'Looks good'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Typecheck + lint**

```bash
npm run typecheck && npm run lint
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/BioApprovalModal.tsx
git commit -m "feat: BioApprovalModal for Stage 1 bio draft approval"
```

---

## Task 11: DevStagePanel component

**Files:**
- Create: `src/components/dev/DevStagePanel.tsx`

- [ ] **Step 1: Write the panel**

```tsx
// src/components/dev/DevStagePanel.tsx
// DEV-ONLY. See src/lib/dev-tools/README.md for deletion instructions.
'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { devForceStage } from '@/app/bot/actions';
import { clearAllCached, listCached } from '@/lib/dev-tools/response-cache';

interface DevStagePanelProps {
  currentStage: number;
}

export function DevStagePanel({ currentStage }: DevStagePanelProps) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [cacheState, setCacheState] = useState({ bio: false, personality: false, matches: false });

  useEffect(() => {
    setCacheState(listCached());
  }, []);

  const jumpTo = async (n: 0 | 1 | 2 | 3) => {
    if (busy) return;
    setBusy(true);
    try {
      await devForceStage(n);
      toast({ title: 'Dev: stage set', description: `Profile is now at stage ${n}. Reloading…` });
      setTimeout(() => window.location.reload(), 300);
    } catch (err) {
      toast({ variant: 'destructive', title: 'Dev action failed', description: String((err as Error).message ?? err) });
    } finally {
      setBusy(false);
    }
  };

  const handleClearCache = () => {
    clearAllCached();
    setCacheState(listCached());
    toast({ title: 'Dev cache cleared' });
  };

  const mark = (on: boolean) => (on ? '✓' : '✗');

  return (
    <div className="fixed bottom-4 right-4 z-50 w-72 rounded-md border border-amber-400 bg-amber-50 p-3 text-xs shadow-lg">
      <div className="mb-2 font-semibold text-amber-900">DEV TOOLS (ENABLED)</div>
      <div className="mb-2 text-amber-800">Current stage: {currentStage}</div>

      <div className="mb-2 flex flex-wrap gap-1">
        <Button size="sm" variant="outline" disabled={busy} onClick={() => jumpTo(1)}>Skip to 1</Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => jumpTo(2)}>Skip to 2</Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => jumpTo(3)}>Skip to 3</Button>
      </div>

      <div className="mb-2 flex flex-wrap gap-1">
        <Button size="sm" variant="destructive" disabled={busy} onClick={() => jumpTo(0)}>
          Reset to stage 0
        </Button>
        <Button size="sm" variant="ghost" onClick={handleClearCache}>
          Clear AI cache
        </Button>
      </div>

      <div className="text-amber-800">
        Cached: bio {mark(cacheState.bio)} · personality {mark(cacheState.personality)} · matches {mark(cacheState.matches)}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

```bash
npm run typecheck && npm run lint
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/dev/DevStagePanel.tsx
git commit -m "feat(dev-tools): floating stage control panel"
```

---

## Task 12: Wire the /bot page

**Files:**
- Modify: `src/app/bot/page.tsx`

This is the biggest wiring task. Break it into sub-steps.

- [ ] **Step 1: Add imports**

At the top of the file (after existing imports around line 27), add:

```ts
import { updateUserStage } from '@/app/bot/actions';
import { BioApprovalModal } from '@/components/BioApprovalModal';
import { DevStagePanel } from '@/components/dev/DevStagePanel';
import { isDevToolsEnabled } from '@/lib/dev-tools/flag';
import { useRow } from '@/supabase/hooks/use-row';
import type { Tables } from '@/supabase/types';
```

(Note: `Tables` may already be imported; if so, skip that line.)

- [ ] **Step 2: Read the user's profile row**

Inside the `AIProfileBot` component, after `const [sessionMessages, setSessionMessages] = useState<...>` (around line 54), add:

```ts
const { data: profileRow } = useRow<Tables<'profiles'>>('profiles', user?.id ?? '', {
  realtime: true,
});
const currentStage = profileRow?.stage ?? 0;
```

- [ ] **Step 3: Add modal + pending-bio state**

Next to the other `useState` hooks, add:

```ts
const [bioModalOpen, setBioModalOpen] = useState(false);
const [pendingBioDraft, setPendingBioDraft] = useState('');
const [awaitingPhoto, setAwaitingPhoto] = useState(false);
const fileInputRef = useRef<HTMLInputElement>(null);
```

- [ ] **Step 4: Handle stageReached + bio in handleSend**

In `handleSend`, after the block that writes `personality_profile` (around line 328), before the `saveAiMsgErr` save call, add:

```ts
// --- Stage progression (runs on every turn, not just interview-complete) ---
const stageMap = { none: 0, stage1: 1, stage2: 2, stage3: 3 } as const;
const veraStage = stageMap[response.stageReached ?? 'none'];
if (veraStage > currentStage) {
  try {
    await updateUserStage(veraStage);
    // Modal fires only on the 0 → 1 transition and only if Vera supplied a bio.
    if (currentStage < 1 && veraStage >= 1 && response.suggestedBio) {
      setPendingBioDraft(response.suggestedBio);
      setBioModalOpen(true);
    }
  } catch (stageErr) {
    console.error('[bot] updateUserStage failed', stageErr);
  }
}

// --- Photo upload UI toggle ---
const hasPhoto = Boolean(profileRow?.photo_url);
setAwaitingPhoto(Boolean(response.requestPhotoUpload) && !hasPhoto);
```

- [ ] **Step 5: Add the photo-upload handler**

After `handleResetConversation` (around line 233), add:

```ts
const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file || !user) return;

  const ext = file.name.split('.').pop() || 'jpg';
  const path = `${user.id}/avatar-${Date.now()}.${ext}`;

  const { error: uploadErr } = await supabase.storage
    .from('profile-photos')
    .upload(path, file, { upsert: true });

  if (uploadErr) {
    toast({ variant: 'destructive', title: 'Upload failed', description: uploadErr.message });
    return;
  }

  const { data: urlData } = supabase.storage.from('profile-photos').getPublicUrl(path);
  const photoUrl = urlData.publicUrl;

  await supabase.from('profiles').update({ photo_url: photoUrl }).eq('id', user.id);

  // Append a synthetic system line so Vera knows on her next turn.
  const systemMsg: ChatMessage = {
    role: 'user',
    message: '[System: User just uploaded their profile photo.]',
    timestamp: new Date().toISOString(),
  };
  const newHistory = [...sessionMessages, systemMsg];
  setSessionMessages(newHistory);
  if (botChat) {
    await supabase
      .from('bot_chats')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({ messages: newHistory as any, updated_at: new Date().toISOString() })
      .eq('id', botChat.id);
  }

  setAwaitingPhoto(false);
  toast({ title: 'Photo uploaded' });
};
```

- [ ] **Step 6: Render the photo button + modal + dev panel**

Find the chat input form JSX (near the bottom of the component's return, look for the `<Textarea ref={textareaRef}` or the `<Send />` button). Add the 📎 button **inside** the same container as the input, gated by `awaitingPhoto`:

```tsx
{awaitingPhoto && (
  <>
    <input
      ref={fileInputRef}
      type="file"
      accept="image/*"
      hidden
      onChange={handlePhotoUpload}
    />
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={() => fileInputRef.current?.click()}
      title="Upload a photo"
    >
      📎
    </Button>
  </>
)}
```

Then, just **before the closing tag of the outermost wrapper element** of the component's return, add:

```tsx
<BioApprovalModal
  open={bioModalOpen}
  initialBio={pendingBioDraft}
  onSave={async (finalBio) => {
    if (!user) return;
    await supabase.from('profiles').update({ bio: finalBio }).eq('id', user.id);
    setBioModalOpen(false);
    toast({ title: 'Bio saved' });
  }}
  onSkip={() => setBioModalOpen(false)}
/>

{isDevToolsEnabled() && <DevStagePanel currentStage={currentStage} />}
```

- [ ] **Step 7: Typecheck + lint**

```bash
npm run typecheck && npm run lint
```

Expected: PASS.

- [ ] **Step 8: Manual smoke test (dev tools disabled)**

Remove or comment out `NEXT_PUBLIC_ENABLE_DEV_TOOLS` in `.env.local` for this step. Then:

```bash
npm run dev
```

Open http://localhost:9002/bot. Expected:
- No yellow DEV TOOLS panel.
- Chat works as before.
- No 📎 button unless Vera asks.

- [ ] **Step 9: Commit**

```bash
git add src/app/bot/page.tsx
git commit -m "feat(bot): wire stage updates, photo upload, bio modal, dev panel"
```

---

## Task 13: Gate the /matches page

**Files:**
- Modify: `src/app/matches/page.tsx`

- [ ] **Step 1: Read the file first**

```bash
wc -l src/app/matches/page.tsx
```

Note total lines so you know what to scroll through.

- [ ] **Step 2: Add imports**

Near the top of the file, add (skip any that already exist):

```ts
import { canUse } from '@/lib/feature-gates';
```

- [ ] **Step 3: Read stage from profile**

Find where `profile` is destructured from `useAuth()` or equivalent. The `MergedProfile` type exposes snake_case fields, so use:

```ts
const stage = profile?.stage ?? 0;
const canInvite = canUse('send_date_invite', stage);
const canBrowse = canUse('browse_matches', stage);
const canVerasInstinct = canUse('veras_instinct', stage);
```

If `MergedProfile` does not yet include `stage`, extend it — open `src/hooks/use-auth.ts` and add `stage?: number | null` to the exposed fields alongside the other snake_case fields.

- [ ] **Step 4: Gate the scan button**

Find the existing `profile?.personalityProfile` check (around line 64 in `handleScanForMatches`). Replace that early return with:

```ts
if (!user || !canBrowse || isScanning) return;
```

- [ ] **Step 5: Gate the Date Invite button**

Find the per-card "Date Invite" button (around lines 298-327). Wrap it so it only renders when `canInvite` is true:

```tsx
{canInvite && (
  /* ...existing Date Invite button JSX... */
)}
```

If the button is inline with other elements, keep the layout tidy — don't leave empty flex gaps.

- [ ] **Step 6: Reword empty state**

Find the "Vibe Profile Hidden" empty state (near the existing `profile?.personalityProfile` copy). Replace its heading + body with:

```tsx
<h2>Matches will appear here</h2>
<p>Keep chatting with Vera for a bit and your curated picks will show up.</p>
<Button onClick={() => router.push('/bot')}>Keep chatting with Vera</Button>
```

Remove any mention of "interview complete", "vibe profile", or stage numbers.

- [ ] **Step 7: Typecheck + lint**

```bash
npm run typecheck && npm run lint
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/app/matches/page.tsx src/hooks/use-auth.ts
git commit -m "feat(matches): gate match browsing and date invites behind stage 1 / stage 2"
```

---

## Task 14: Gate the /profile page

**Files:**
- Modify: `src/app/profile/page.tsx`

- [ ] **Step 1: Add imports + read stage**

At the top of `/profile/page.tsx`, add:

```ts
import { canUse } from '@/lib/feature-gates';
import { useRouter } from 'next/navigation';
```

Inside the component, after the existing profile hook, add:

```ts
const router = useRouter();
const stage = profile?.stage ?? 0;
const showFullProfile = canUse('view_profile_page', stage);
```

- [ ] **Step 2: Render pre-stage-1 empty state**

At the very top of the component's JSX return, add an early branch:

```tsx
if (!showFullProfile) {
  return (
    <div className="mx-auto max-w-md px-4 py-12 text-center">
      <h1 className="text-2xl font-semibold">Let&apos;s finish your introduction first</h1>
      <p className="mt-2 text-muted-foreground">
        Head back to the chat with Vera — once she has enough to work with, your profile will be ready.
      </p>
      <Button className="mt-6" onClick={() => router.push('/bot')}>
        Keep chatting with Vera
      </Button>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck + lint**

```bash
npm run typecheck && npm run lint
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/profile/page.tsx
git commit -m "feat(profile): show 'finish with Vera' empty state before stage 1"
```

---

## Task 15: Gate the /requests page

**Files:**
- Modify: `src/app/requests/page.tsx`

- [ ] **Step 1: Add imports + read stage**

At the top of `/requests/page.tsx`, add:

```ts
import { canUse } from '@/lib/feature-gates';
```

Inside the component, after the profile hook, add:

```ts
const stage = profile?.stage ?? 0;
const canAccept = canUse('accept_date_invite', stage);
```

- [ ] **Step 2: Hide the "Accept Date" button when gated**

Find the `Accept Date` button in the incoming-request card (around line 165-209 per the exploration report). Wrap:

```tsx
{canAccept && (
  /* ...existing Accept Date button... */
)}
```

Keep the existing identity-verification check (`identity_verified`) in place — both gates run in parallel; accept appears only when both pass.

- [ ] **Step 3: Typecheck + lint**

```bash
npm run typecheck && npm run lint
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/requests/page.tsx
git commit -m "feat(requests): gate 'Accept Date' behind stage 2"
```

---

## Task 16: Env setup + full-flow verification

**Files:**
- Modify: `.env.local` (not committed)

- [ ] **Step 1: Add dev flags to .env.local**

Open `.env.local` (or create it from `.env.example` if that exists) and add:

```
NEXT_PUBLIC_ENABLE_DEV_TOOLS=true
ENABLE_DEV_TOOLS=true
```

**Do not commit this file.** Confirm `.env.local` is in `.gitignore`:

```bash
grep "^\.env\.local" .gitignore || echo ".env.local" >> .gitignore
```

- [ ] **Step 2: Full build**

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 3: Start dev server**

```bash
npm run dev
```

- [ ] **Step 4: Manual test — fresh user**

Open http://localhost:9002/auth/signup in a private window. Sign up a new account. After email verify, land on `/bot`. Expected:
- Yellow "DEV TOOLS (ENABLED)" panel in bottom-right.
- Current stage: 0.
- `/profile` shows the "Let's finish your introduction" empty state.
- `/matches` shows the "Matches will appear here" empty state (no invite buttons).
- `/requests` loads but no Accept buttons visible.

- [ ] **Step 5: Manual test — dev skip to stage 1**

Click `Skip to 1` in the dev panel. Page reloads. Expected:
- `/profile` now renders full profile (bio = tester bio, photo = picsum URL).
- `/matches` now shows matches (or an empty matches list depending on DB data). No Date Invite button yet.

- [ ] **Step 6: Manual test — dev skip to stage 2**

Click `Skip to 2`. Expected:
- Date Invite button now appears on match cards.
- `/requests` now shows Accept button on incoming invites (if any exist).

- [ ] **Step 7: Manual test — dev skip to stage 3**

Click `Skip to 3`. Expected:
- Stage indicator in panel shows 3. (Vera's Instinct wild-card matches are scaffolded for stage 3 but the feature itself isn't built in this plan — just confirm the stage flip works.)

- [ ] **Step 8: Manual test — reset**

Click `Reset to stage 0`. Expected:
- Panel shows stage 0. All features hide again. `/bot` chat history is empty.

- [ ] **Step 9: Manual test — production simulation**

Edit `.env.local` and set both env vars to `false` (or delete the lines). Restart `npm run dev`. Expected:
- No dev panel visible anywhere.
- Attempting to invoke `devForceStage` from browser devtools (via a POST to the action) returns an error.

- [ ] **Step 10: Manual test — real Vera conversation**

Put env vars back to `true`, reset to stage 0, and actually chat with Vera. Answer her questions naturally. Expected:
- Stage advances to 1 organically after basics + goals + deal-breaker + photo.
- 📎 button appears on the turn Vera asks for a photo.
- After uploading, Vera acknowledges on her next turn.
- Bio modal appears the moment stage flips 0 → 1.

- [ ] **Step 11: Final commit (if any fixups)**

If you had to tweak wording, fix a typo, or shim anything during manual testing:

```bash
git add -A  # review with `git diff --cached` first
git commit -m "fix: polish discovered during end-to-end manual test"
```

If nothing needed fixing, skip this step.

---

## Done

All 16 tasks complete. The staged-interview gating is live behind dev tools. When it's time to ship to production members, follow the deletion checklist in `src/lib/dev-tools/README.md`.
