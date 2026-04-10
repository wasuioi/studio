-- 001_initial_schema.sql
-- TrueVibe Postgres schema: profiles, posts, personality_profiles, bot_chats,
-- chat_requests, conversations, messages.
-- Replaces Firestore collections users, users/*/posts, users/*/personality,
-- bot_chats, chat_requests, conversations, conversations/*/messages.

-- =========================================================================
-- Extensions
-- =========================================================================
create extension if not exists "pgcrypto";  -- gen_random_uuid()

-- =========================================================================
-- profiles — one row per authenticated user
-- =========================================================================
create table public.profiles (
  id                    uuid primary key references auth.users(id) on delete cascade,
  email                 text not null,
  display_name          text,
  bio                   text,
  photo_url             text,
  identity_verified     boolean not null default false,
  verification_status   text not null default 'not_verified'
                          check (verification_status in ('not_verified','pending','verified','rejected')),
  profile_completed     boolean not null default false,
  tier                  text not null default 'free'
                          check (tier in ('free','premium')),
  last_login            timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

comment on table public.profiles is
  'Replaces Firestore users/{userId}. id is the same UUID as auth.users.id.';

-- =========================================================================
-- posts — user-authored posts shown on profile
-- =========================================================================
create table public.posts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  content     text,
  photo_url   text,
  created_at  timestamptz not null default now()
);

create index posts_user_id_created_at_idx
  on public.posts (user_id, created_at desc);

comment on table public.posts is
  'Replaces Firestore users/{uid}/posts/*';

-- =========================================================================
-- personality_profiles — finalized Vera interview output (one row per user)
-- =========================================================================
create table public.personality_profiles (
  user_id        uuid primary key references public.profiles(id) on delete cascade,
  partner_vision text,
  traits         jsonb,
  summary        text,
  completed_at   timestamptz
);

comment on table public.personality_profiles is
  'Replaces Firestore users/{uid}/personality/*. Finalized interview output.';

-- =========================================================================
-- bot_chats — Vera 3-phase interview conversation history
-- =========================================================================
create table public.bot_chats (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  phase       int not null default 1,
  messages    jsonb not null default '[]'::jsonb,
  completed   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index bot_chats_user_id_updated_at_idx
  on public.bot_chats (user_id, updated_at desc);

comment on table public.bot_chats is
  'Replaces Firestore bot_chats/{chatId}. Vera interview transcript.';

-- =========================================================================
-- chat_requests — "Can we chat?" requests between users
-- =========================================================================
create table public.chat_requests (
  id          uuid primary key default gen_random_uuid(),
  sender_id   uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  status      text not null default 'pending'
                check (status in ('pending','accepted','rejected')),
  message     text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (sender_id, receiver_id),
  check (sender_id <> receiver_id)
);

create index chat_requests_receiver_status_idx
  on public.chat_requests (receiver_id, status);
create index chat_requests_sender_status_idx
  on public.chat_requests (sender_id, status);

comment on table public.chat_requests is
  'Replaces Firestore chat_requests/{requestId}.';

-- =========================================================================
-- conversations — 1:1 DM threads between two users
-- =========================================================================
create table public.conversations (
  id               uuid primary key default gen_random_uuid(),
  participant_ids  uuid[] not null,
  last_message_at  timestamptz,
  created_at       timestamptz not null default now(),
  check (array_length(participant_ids, 1) = 2),
  check (participant_ids[1] < participant_ids[2])  -- enforce sorted order for uniqueness
);

-- Uniqueness: one conversation per sorted pair of participants
create unique index conversations_participants_uniq
  on public.conversations (participant_ids);

-- GIN index so "user X is in conversation" queries are fast
create index conversations_participants_gin
  on public.conversations using gin (participant_ids);

comment on table public.conversations is
  'Replaces Firestore conversations/{conversationId}. participant_ids must be sorted ascending to prevent duplicate pairs.';

-- =========================================================================
-- messages — individual messages within a conversation
-- =========================================================================
create table public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id       uuid not null references public.profiles(id) on delete cascade,
  content         text not null,
  read_at         timestamptz,
  created_at      timestamptz not null default now()
);

create index messages_conversation_created_at_idx
  on public.messages (conversation_id, created_at desc);

comment on table public.messages is
  'Replaces Firestore conversations/{cid}/messages/*. Immutable — no UPDATE/DELETE policies.';

-- =========================================================================
-- updated_at auto-update trigger (shared)
-- =========================================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger bot_chats_set_updated_at
  before update on public.bot_chats
  for each row execute function public.set_updated_at();

create trigger chat_requests_set_updated_at
  before update on public.chat_requests
  for each row execute function public.set_updated_at();
