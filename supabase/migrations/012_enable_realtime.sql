-- Migration 012: ensure the supabase_realtime publication covers the tables
-- we subscribe to from the client. Without this, the dashboard replication
-- toggle must be set manually per environment — easy to forget, and when
-- missed the /requests, /messages and /matches pages show stale data after
-- writes.
--
-- Safe to re-run: ALTER PUBLICATION ... ADD TABLE is a no-op when the table
-- is already a member (Postgres 14+). If your project predates that, remove
-- the table first via ALTER PUBLICATION supabase_realtime DROP TABLE ...
-- or skip the lines that already list the table.

ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bot_chats;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
