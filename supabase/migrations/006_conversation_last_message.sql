-- 006_conversation_last_message.sql
-- Add last_message preview column to conversations so the sidebar list
-- in /messages can show a snippet without an extra query.

alter table public.conversations
  add column if not exists last_message text;
