alter table public.quotations
  add column if not exists recipient_emails text[] not null default '{}'::text[];
