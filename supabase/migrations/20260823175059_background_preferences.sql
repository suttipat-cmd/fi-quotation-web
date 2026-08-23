-- Background preferences are presentation-only. Login appearance must be
-- readable before authentication, while assignments remain admin-managed.
alter table public.profiles
  add column if not exists app_background_key text not null default 'terraria'
    check (app_background_key in ('terraria', 'battlefield', 'shinchan', 'custom')),
  add column if not exists app_background_url text;

create table if not exists public.login_appearance (
  id boolean primary key default true check (id),
  background_key text not null default 'terraria'
    check (background_key in ('terraria', 'battlefield', 'shinchan', 'custom')),
  background_url text,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

insert into public.login_appearance (id)
values (true)
on conflict (id) do nothing;

alter table public.login_appearance enable row level security;

revoke all on public.login_appearance from anon, authenticated;
grant select on public.login_appearance to anon, authenticated;
grant update on public.login_appearance to authenticated;

drop policy if exists "login appearance readable publicly" on public.login_appearance;
create policy "login appearance readable publicly"
  on public.login_appearance for select
  to anon, authenticated
  using (true);

drop policy if exists "admins manage login appearance" on public.login_appearance;
create policy "admins manage login appearance"
  on public.login_appearance for update
  to authenticated
  using (app.is_admin())
  with check (app.is_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'app-backgrounds',
  'app-backgrounds',
  true,
  10485760,
  array['image/png', 'image/jpeg', 'image/webp']::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "admins upload app backgrounds" on storage.objects;
create policy "admins upload app backgrounds"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'app-backgrounds' and app.is_admin());

drop policy if exists "admins update app backgrounds" on storage.objects;
create policy "admins update app backgrounds"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'app-backgrounds' and app.is_admin())
  with check (bucket_id = 'app-backgrounds' and app.is_admin());

drop policy if exists "admins delete app backgrounds" on storage.objects;
create policy "admins delete app backgrounds"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'app-backgrounds' and app.is_admin());
