-- 010_fix_email_verified_check.sql
-- Fix is_email_verified(): the previous implementation read
--   auth.jwt()->>'email_confirmed_at'
-- but 'email_confirmed_at' is NOT a top-level claim in Supabase's standard JWT
-- (the JWT carries email/sub/role/user_metadata/app_metadata but not this
-- field). That meant the function always returned false and every RLS policy
-- that depends on it silently blocked all writes from real users.
--
-- Rewrite the function to query auth.users directly, keyed by auth.uid().
-- Runs with security definer so the caller does not need rights on auth.users.

create or replace function public.is_email_verified()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1
    from auth.users
    where id = auth.uid()
      and email_confirmed_at is not null
  );
$$;

comment on function public.is_email_verified() is
  'Returns true if the currently authenticated user has confirmed their email. '
  'Reads auth.users.email_confirmed_at directly because that field is not in the JWT.';
