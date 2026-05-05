-- 013_post_date_feedback.sql
-- Adds date_feedback table + chat_requests.scheduled_at for the
-- post-date feedback feature (see
-- docs/superpowers/specs/2026-05-05-post-date-feedback-design.md).

-- =========================================================================
-- chat_requests — proper datetime for the planned date
-- =========================================================================
alter table public.chat_requests
  add column if not exists scheduled_at timestamptz;

comment on column public.chat_requests.scheduled_at is
  'Proper timestamptz of the planned date. Source of truth for the post-date feedback cron. Existing suggested_date_time text column is kept for display.';

-- =========================================================================
-- date_feedback — one row per (chat_request, user)
-- =========================================================================
create table public.date_feedback (
  id uuid primary key default gen_random_uuid(),
  chat_request_id uuid not null references public.chat_requests(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,

  pill_choice text check (pill_choice in ('positive','neutral','negative','dismissed')),
  conversation jsonb not null default '[]'::jsonb,

  status text not null default 'nudged'
    check (status in ('nudged','in_progress','completed','dismissed')),

  nudge_count int,

  first_nudged_at  timestamptz,
  second_nudged_at timestamptz,
  started_at       timestamptz,
  completed_at     timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (chat_request_id, user_id)
);

comment on table public.date_feedback is
  'Stores the post-date check-in for each side of an offline date. One row per (chat_request, user). Conversation lives in the conversation jsonb (separate from bot_chats).';

create index date_feedback_user_status_idx
  on public.date_feedback (user_id, status);

create index date_feedback_chat_request_idx
  on public.date_feedback (chat_request_id);

-- =========================================================================
-- Row Level Security
-- =========================================================================
alter table public.date_feedback enable row level security;

create policy "Users can read their own feedback"
  on public.date_feedback for select
  using (auth.uid() = user_id);

create policy "Users can insert their own feedback"
  on public.date_feedback for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own feedback"
  on public.date_feedback for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- =========================================================================
-- Privileged column lockdown — same pattern as migration 007
-- Status / pill_choice / nudge counters and timestamps must only be
-- writable from trusted server code (cron + AI flow via service-role
-- admin client). The browser client may set started_at and append to
-- conversation through the server actions.
-- =========================================================================
revoke update (
  status,
  pill_choice,
  nudge_count,
  first_nudged_at,
  second_nudged_at,
  completed_at
) on public.date_feedback from anon, authenticated;
