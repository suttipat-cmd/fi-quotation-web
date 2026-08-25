-- Profile photos are managed by administrators and displayed throughout the app.
alter table public.profiles
  add column if not exists avatar_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-avatars',
  'profile-avatars',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp']::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "admins upload profile avatars" on storage.objects;
create policy "admins upload profile avatars"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'profile-avatars' and app.is_admin());

drop policy if exists "admins update profile avatars" on storage.objects;
create policy "admins update profile avatars"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'profile-avatars' and app.is_admin())
  with check (bucket_id = 'profile-avatars' and app.is_admin());

drop policy if exists "admins delete profile avatars" on storage.objects;
create policy "admins delete profile avatars"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'profile-avatars' and app.is_admin());
