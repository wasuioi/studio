-- 004_handle_new_user.sql
-- Trigger that auto-creates a profiles row whenever a new auth.users row is
-- inserted. Replaces src/components/UserProfileInitializer.tsx.
--
-- Runs as SECURITY DEFINER so it bypasses RLS (which denies INSERT on
-- profiles for all clients — only this trigger is allowed to insert).

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, tier, created_at, updated_at)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    'free',
    now(),
    now()
  );
  return new;
end;
$$;

-- Remove any existing trigger with the same name before recreating
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
