-- 003_storage_buckets.sql
-- Supabase Storage buckets and their RLS policies.
--
-- Two public-read buckets:
--   profile-photos — user profile pictures
--   post-photos    — photos attached to posts
-- Verification ID photos are NOT stored — they stay in the browser and are
-- passed directly to the AI flow.

-- =========================================================================
-- Create buckets (public-read, 5 MB limit, image MIME types only)
-- =========================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('profile-photos', 'profile-photos', true, 5242880,
     array['image/jpeg','image/png','image/webp','image/gif']),
  ('post-photos',    'post-photos',    true, 5242880,
     array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do nothing;

-- =========================================================================
-- profile-photos RLS
-- =========================================================================
create policy "profile_photos_public_read"
  on storage.objects for select
  to public
  using (bucket_id = 'profile-photos');

create policy "profile_photos_insert_own_folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "profile_photos_update_own_folder"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "profile_photos_delete_own_folder"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- =========================================================================
-- post-photos RLS
-- =========================================================================
create policy "post_photos_public_read"
  on storage.objects for select
  to public
  using (bucket_id = 'post-photos');

create policy "post_photos_insert_own_folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'post-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "post_photos_update_own_folder"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'post-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "post_photos_delete_own_folder"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'post-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
