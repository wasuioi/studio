-- 002_rls_policies.sql
-- Row Level Security policies replacing firestore.rules.
-- Defaults to DENY — every policy is an explicit allow.

-- =========================================================================
-- Helper functions
-- =========================================================================
create or replace function public.is_email_verified()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (auth.jwt()->>'email')::text is not null
     and coalesce((auth.jwt()->>'email_confirmed_at')::text, '') <> '';
$$;

create or replace function public.is_conversation_participant(conv_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.conversations
    where id = conv_id and auth.uid() = any(participant_ids)
  );
$$;

-- =========================================================================
-- profiles
-- =========================================================================
alter table public.profiles enable row level security;

create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

create policy "profiles_update_self"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- No INSERT policy: only the handle_new_user trigger (SECURITY DEFINER) inserts.
-- No DELETE policy: deletion cascades from auth.users.

-- =========================================================================
-- posts
-- =========================================================================
alter table public.posts enable row level security;

create policy "posts_select_authenticated"
  on public.posts for select
  to authenticated
  using (true);

create policy "posts_insert_owner_verified"
  on public.posts for insert
  to authenticated
  with check (user_id = auth.uid() and public.is_email_verified());

create policy "posts_update_owner"
  on public.posts for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "posts_delete_owner"
  on public.posts for delete
  to authenticated
  using (user_id = auth.uid());

-- =========================================================================
-- personality_profiles
-- =========================================================================
alter table public.personality_profiles enable row level security;

create policy "personality_profiles_select_owner"
  on public.personality_profiles for select
  to authenticated
  using (user_id = auth.uid());

create policy "personality_profiles_insert_owner"
  on public.personality_profiles for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "personality_profiles_update_owner"
  on public.personality_profiles for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "personality_profiles_delete_owner"
  on public.personality_profiles for delete
  to authenticated
  using (user_id = auth.uid());

-- =========================================================================
-- bot_chats
-- =========================================================================
alter table public.bot_chats enable row level security;

create policy "bot_chats_select_owner"
  on public.bot_chats for select
  to authenticated
  using (user_id = auth.uid());

create policy "bot_chats_insert_owner"
  on public.bot_chats for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "bot_chats_update_owner"
  on public.bot_chats for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "bot_chats_delete_owner"
  on public.bot_chats for delete
  to authenticated
  using (user_id = auth.uid());

-- =========================================================================
-- chat_requests
-- =========================================================================
alter table public.chat_requests enable row level security;

create policy "chat_requests_select_participant"
  on public.chat_requests for select
  to authenticated
  using (sender_id = auth.uid() or receiver_id = auth.uid());

create policy "chat_requests_insert_sender_verified"
  on public.chat_requests for insert
  to authenticated
  with check (sender_id = auth.uid() and public.is_email_verified());

create policy "chat_requests_update_participant"
  on public.chat_requests for update
  to authenticated
  using (sender_id = auth.uid() or receiver_id = auth.uid())
  with check (sender_id = auth.uid() or receiver_id = auth.uid());

create policy "chat_requests_delete_participant"
  on public.chat_requests for delete
  to authenticated
  using (sender_id = auth.uid() or receiver_id = auth.uid());

-- =========================================================================
-- conversations
-- =========================================================================
alter table public.conversations enable row level security;

create policy "conversations_select_participant_verified"
  on public.conversations for select
  to authenticated
  using (auth.uid() = any(participant_ids) and public.is_email_verified());

create policy "conversations_insert_participant_verified"
  on public.conversations for insert
  to authenticated
  with check (auth.uid() = any(participant_ids) and public.is_email_verified());

create policy "conversations_update_participant_verified"
  on public.conversations for update
  to authenticated
  using (auth.uid() = any(participant_ids) and public.is_email_verified())
  with check (auth.uid() = any(participant_ids) and public.is_email_verified());

create policy "conversations_delete_participant_verified"
  on public.conversations for delete
  to authenticated
  using (auth.uid() = any(participant_ids) and public.is_email_verified());

-- =========================================================================
-- messages
-- =========================================================================
alter table public.messages enable row level security;

create policy "messages_select_participant_verified"
  on public.messages for select
  to authenticated
  using (
    public.is_email_verified()
    and public.is_conversation_participant(conversation_id)
  );

create policy "messages_insert_sender_participant_verified"
  on public.messages for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and public.is_email_verified()
    and public.is_conversation_participant(conversation_id)
  );

-- No UPDATE or DELETE policies: messages are immutable once sent.
